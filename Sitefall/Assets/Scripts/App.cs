using System.Collections;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Sitefall
{
    public class App : MonoBehaviour
    {
        public static App Instance { get; private set; }

        FrontEnd menu;
        Hud hud;
        Transform booth;
        BodyRig preview;
        bool busy;
        string hostIp = "127.0.0.1";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<App>() != null) return;
            var go = new GameObject("Sitefall");
            DontDestroyOnLoad(go);
            go.AddComponent<App>();
        }

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            Session.Load();
            Application.runInBackground = true;
            Application.targetFrameRate = 120;
            Physics.IgnoreLayerCollision(Rules.LayerPawn, Rules.LayerPawn, true);
            if (FindAnyObjectByType<EventSystem>() == null)
            {
                var events = new GameObject("EventSystem");
                events.AddComponent<EventSystem>();
                events.AddComponent<StandaloneInputModule>();
            }
        }

        void Start()
        {
            menu = gameObject.AddComponent<FrontEnd>();
            hud = gameObject.AddComponent<Hud>();
            menu.Build();
            hud.Build();
            menu.OnHost = StartHost;
            menu.OnJoin = StartJoin;
            menu.OnLeave = () => StartCoroutine(Leave());
            BuildBooth();
            var cam = Camera.main;
            if (cam != null)
            {
                cam.nearClipPlane = 0.05f;
                cam.farClipPlane = 250f;
                cam.fieldOfView = 72f;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0.16f, 0.18f, 0.22f);
            }
        }

        void BuildBooth()
        {
            booth = new GameObject("Booth").transform;
            booth.position = new Vector3(80f, 0f, 80f);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.transform.SetParent(booth, false);
            floor.transform.localPosition = new Vector3(0f, -0.25f, 0f);
            floor.transform.localScale = new Vector3(8f, 0.5f, 8f);
            floor.GetComponent<Renderer>().sharedMaterial = Palette.Mat(new Color(0.12f, 0.13f, 0.15f), 0.4f, 0.1f);
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.transform.SetParent(booth, false);
            wall.transform.localPosition = new Vector3(0f, 1.8f, 2.4f);
            wall.transform.localScale = new Vector3(8f, 4.2f, 0.3f);
            wall.GetComponent<Renderer>().sharedMaterial = Palette.Mat(new Color(0.18f, 0.2f, 0.24f), 0.3f);
            var light = new GameObject("BoothLight");
            light.transform.SetParent(booth, false);
            light.transform.localPosition = new Vector3(0f, 3f, -1.5f);
            var lamp = light.AddComponent<Light>();
            lamp.type = LightType.Spot;
            lamp.range = 12f;
            lamp.spotAngle = 60f;
            lamp.intensity = 3.5f;
            lamp.color = new Color(1f, 0.9f, 0.8f);
            RefreshPreview();
        }

        void RefreshPreview()
        {
            if (preview != null) Destroy(preview.gameObject);
            int style = Session.Mode == 0 ? (Session.HostIsKiller ? 0 : 1) : 2;
            bool rifle = style != 1;
            var anchor = new GameObject("Preview").transform;
            anchor.SetParent(booth, false);
            anchor.localPosition = new Vector3(1.1f, 0f, 0.2f);
            preview = BodyBuilder.Create(anchor, style, rifle, 0);
        }

        void Update()
        {
            if (preview != null)
            {
                preview.transform.parent.Rotate(0f, 18f * Time.deltaTime, 0f);
                int style = Session.Mode == 0 ? (Session.HostIsKiller ? 0 : 1) : Session.Mode == 2 ? 2 : 2;
                if (menu != null && menu.Visible && preview.Style != style)
                    RefreshPreview();
                BodyMotion.Tick(preview, 0.4f, Time.deltaTime);
            }

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                if (Match.Instance == null)
                {
                    if (menu != null && menu.Visible) return;
                }
                else if (Cursor.lockState == CursorLockMode.Locked)
                {
                    Cursor.lockState = CursorLockMode.None;
                    Cursor.visible = true;
                    menu.ShowPause();
                }
                else if (menu.Visible)
                {
                    menu.Hide();
                    if (Hud.LocalPlayer() != null && Hud.LocalPlayer().Alive.Value)
                    {
                        Cursor.lockState = CursorLockMode.Locked;
                        Cursor.visible = false;
                    }
                }
            }

            var cam = Camera.main;
            if (cam == null) return;
            if (View.Claimed && View.Eye != null)
            {
                float bob = Mathf.Sin(Time.time * 9f) * 0.012f * View.Bob;
                cam.transform.position = View.Eye.position + Vector3.up * bob;
                cam.transform.rotation = View.Eye.rotation * Quaternion.Euler(View.Pitch, 0f, 0f);
            }
            else if (Match.Instance != null)
            {
                var overview = new Vector3(0f, 26f, -22f);
                cam.transform.position = Vector3.Lerp(cam.transform.position, overview, 1f - Mathf.Exp(-2f * Time.deltaTime));
                cam.transform.rotation = Quaternion.Slerp(cam.transform.rotation, Quaternion.LookRotation(-overview.normalized + Vector3.down * 0.15f), 1f - Mathf.Exp(-2f * Time.deltaTime));
            }
            else
            {
                var from = booth.position + new Vector3(-2.4f, 1.55f, -3.3f);
                cam.transform.position = from;
                cam.transform.LookAt(booth.position + new Vector3(1.1f, 1.15f, 0.2f));
            }
        }

        void StartHost()
        {
            if (busy) return;
            if (!PrepareNetwork()) return;
            var transport = NetworkManager.Singleton.GetComponent<UnityTransport>();
            transport.SetConnectionData("127.0.0.1", Rules.Port, "0.0.0.0");
            NetworkManager.Singleton.OnClientConnectedCallback += OnConnected;
            NetworkManager.Singleton.OnClientDisconnectCallback += OnDisconnected;
            if (!NetworkManager.Singleton.StartHost())
            {
                menu.SetStatus("방을 만들지 못했습니다. 포트 " + Rules.Port + " 를 확인하세요.");
                CleanupNetwork();
                return;
            }
            hostIp = LanAddress();
            var matchObject = Instantiate(Resources.Load<GameObject>("Match"));
            var match = matchObject.GetComponent<Match>();
            match.ServerConfigure(Session.Mode);
            matchObject.GetComponent<NetworkObject>().Spawn(true);
            menu.Hide();
            menu.SetStatus("방 주소  " + hostIp);
            busy = true;
        }

        void StartJoin(string address)
        {
            if (busy) return;
            if (!PrepareNetwork()) return;
            var transport = NetworkManager.Singleton.GetComponent<UnityTransport>();
            transport.SetConnectionData(address, Rules.Port);
            NetworkManager.Singleton.OnClientDisconnectCallback += OnDisconnected;
            NetworkManager.Singleton.OnClientConnectedCallback += _ => menu.Hide();
            if (!NetworkManager.Singleton.StartClient())
            {
                menu.SetStatus("접속에 실패했습니다.");
                CleanupNetwork();
                return;
            }
            menu.SetStatus(address + " 에 접속하는 중");
            busy = true;
            StartCoroutine(JoinTimeout());
        }

        IEnumerator JoinTimeout()
        {
            float wait = 8f;
            while (wait > 0f && busy && (NetworkManager.Singleton == null || !NetworkManager.Singleton.IsConnectedClient))
            {
                wait -= Time.deltaTime;
                yield return null;
            }
            if (NetworkManager.Singleton != null && !NetworkManager.Singleton.IsConnectedClient && busy)
            {
                menu.SetStatus("접속 시간이 초과되었습니다.");
                yield return Leave();
            }
        }

        bool PrepareNetwork()
        {
            var soldier = Resources.Load<GameObject>("Soldier");
            var match = Resources.Load<GameObject>("Match");
            if (soldier == null || match == null)
            {
                menu.SetStatus("네트워크 프리팹이 아직 없습니다.\n유니티가 스크립트를 컴파일한 뒤 플레이를 다시 누르세요.");
                return false;
            }
            var go = new GameObject("NetworkManager");
            var manager = go.AddComponent<NetworkManager>();
            var transport = go.AddComponent<UnityTransport>();
            manager.NetworkConfig.NetworkTransport = transport;
            manager.NetworkConfig.ConnectionApproval = true;
            manager.NetworkConfig.PlayerPrefab = null;
            manager.NetworkConfig.EnableSceneManagement = false;
            manager.NetworkConfig.TickRate = 30;
            manager.ConnectionApprovalCallback = Approve;
            manager.AddNetworkPrefab(soldier);
            manager.AddNetworkPrefab(match);
            return true;
        }

        static void Approve(NetworkManager.ConnectionApprovalRequest request, NetworkManager.ConnectionApprovalResponse response)
        {
            response.Approved = true;
            response.CreatePlayerObject = false;
            response.Pending = false;
        }

        void OnConnected(ulong clientId)
        {
            if (NetworkManager.Singleton == null || !NetworkManager.Singleton.IsServer) return;
            if (clientId == NetworkManager.ServerClientId) return;
            if (Match.Instance != null) Match.Instance.ReplaceWithHuman(clientId);
        }

        void OnDisconnected(ulong clientId)
        {
            if (NetworkManager.Singleton == null) return;
            if (NetworkManager.Singleton.IsServer)
            {
                if (clientId != NetworkManager.ServerClientId && Match.Instance != null)
                    Match.Instance.ReplaceWithBot(clientId);
                return;
            }
            menu.SetStatus("연결이 끊겼습니다.");
            StartCoroutine(Leave());
        }

        IEnumerator Leave()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            View.Claimed = false;
            View.Eye = null;
            if (NetworkManager.Singleton != null)
            {
                NetworkManager.Singleton.Shutdown();
                while (NetworkManager.Singleton != null && NetworkManager.Singleton.ShutdownInProgress)
                    yield return null;
                if (NetworkManager.Singleton != null) Destroy(NetworkManager.Singleton.gameObject);
            }
            Arena.Clear();
            busy = false;
            menu.Reveal();
            var cam = Camera.main;
            if (cam != null)
            {
                cam.transform.position = booth.position + new Vector3(-2.4f, 1.55f, -3.3f);
                cam.transform.LookAt(booth.position + new Vector3(1.1f, 1.15f, 0.2f));
            }
        }

        void CleanupNetwork()
        {
            if (NetworkManager.Singleton != null) Destroy(NetworkManager.Singleton.gameObject);
            busy = false;
        }

        static string LanAddress()
        {
            try
            {
                foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (adapter.OperationalStatus != OperationalStatus.Up) continue;
                    foreach (var unicast in adapter.GetIPProperties().UnicastAddresses)
                    {
                        if (unicast.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                        if (IPAddress.IsLoopback(unicast.Address)) continue;
                        return unicast.Address.ToString();
                    }
                }
            }
            catch { }
            return "127.0.0.1";
        }
    }
}

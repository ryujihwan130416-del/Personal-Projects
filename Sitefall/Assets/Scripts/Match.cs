using System.Collections;
using System.Collections.Generic;
using Unity.Netcode;
using UnityEngine;

namespace Sitefall
{
    public class Match : NetworkBehaviour
    {
        public static Match Instance { get; private set; }

        public NetworkVariable<int> Mode = new NetworkVariable<int>(0);
        public NetworkVariable<int> Phase = new NetworkVariable<int>(0);
        public NetworkVariable<float> TimeLeft = new NetworkVariable<float>(0f);
        public NetworkVariable<int> Score0 = new NetworkVariable<int>(0);
        public NetworkVariable<int> Score1 = new NetworkVariable<int>(0);
        public NetworkVariable<int> Round = new NetworkVariable<int>(0);
        public NetworkVariable<bool> Swapped = new NetworkVariable<bool>(false);
        public NetworkVariable<int> BombState = new NetworkVariable<int>(0);
        public NetworkVariable<int> BombSite = new NetworkVariable<int>(-1);
        public NetworkVariable<float> ActionTime = new NetworkVariable<float>(0f);
        public NetworkVariable<ulong> Carrier = new NetworkVariable<ulong>(ulong.MaxValue);

        public string Banner = "";
        readonly Dictionary<ulong, Role> humans = new Dictionary<ulong, Role>();
        readonly List<ulong> pendingHumans = new List<ulong>();
        bool ending;
        float tick;
        float plant;
        float defuse;
        float fuse;
        Vector3 dropPoint;

        struct Role
        {
            public int Team;
            public int Kind;
            public int Number;
        }

        void Awake() => Instance = this;

        public override void OnNetworkSpawn()
        {
            Instance = this;
            Arena.Build();
            if (IsServer) StartCoroutine(OpenRound(true));
        }

        public override void OnNetworkDespawn()
        {
            if (Instance == this) Instance = null;
        }

        public void ServerConfigure(int mode) => Mode.Value = mode;

        IEnumerator OpenRound(bool first)
        {
            Phase.Value = 2;
            if (!first)
                yield return new WaitForSeconds(3.2f);
            if (Mode.Value != 0 && (Score0.Value >= Rules.RoundsToWin || Score1.Value >= Rules.RoundsToWin))
            {
                Phase.Value = 3;
                BannerClientRpc(Score0.Value == Score1.Value ? "무승부" : Score0.Value > Score1.Value ? "파랑 매치 승리" : "올리브 매치 승리");
                yield break;
            }
            if (Mode.Value == 0 && !first)
            {
                Phase.Value = 3;
                yield break;
            }

            int next = Round.Value + 1;
            if (Mode.Value == 2 && next == 5 && !Swapped.Value)
            {
                Swapped.Value = true;
                BannerClientRpc("공수 교대");
                yield return new WaitForSeconds(1.4f);
            }
            Round.Value = next;
            SpawnRound();
            plant = 0f;
            defuse = 0f;
            fuse = Rules.FuseTime;
            BombState.Value = 0;
            BombSite.Value = -1;
            ActionTime.Value = 0f;
            if (Mode.Value == 0) TimeLeft.Value = Rules.HuntTime;
            else if (Mode.Value == 1) TimeLeft.Value = Rules.ElimTime;
            else TimeLeft.Value = Rules.RoundTime;
            Phase.Value = 1;
            ending = false;
            BannerClientRpc(Mode.Value == 0 ? "사냥 시작" : "라운드 " + next);
            AssignCarrier();
            FlushPending();
        }

        void SpawnRound()
        {
            humans.Clear();
            var slots = new List<RoleSpawn>();
            if (Mode.Value == 0)
            {
                slots.Add(new RoleSpawn { Team = 0, Kind = 0, Number = 1, Pos = Arena.KillerSpawn, Yaw = 0f });
                for (int i = 0; i < 10; i++)
                    slots.Add(new RoleSpawn { Team = 1, Kind = 1, Number = i + 1, Pos = Arena.CitizenSpawns[i], Yaw = 180f });
            }
            else
            {
                bool attackTeam0 = !Swapped.Value || Mode.Value != 2;
                if (Mode.Value != 2) attackTeam0 = true;
                for (int i = 0; i < 5; i++)
                {
                    int team = attackTeam0 ? 0 : 1;
                    slots.Add(new RoleSpawn { Team = team, Kind = 2, Number = i + 1, Pos = Arena.AttackSpawns[i], Yaw = 0f });
                }
                for (int i = 0; i < 5; i++)
                {
                    int team = attackTeam0 ? 1 : 0;
                    slots.Add(new RoleSpawn { Team = team, Kind = 3, Number = i + 1, Pos = Arena.DefenseSpawns[i], Yaw = 180f });
                }
            }

            var people = new List<ulong>(NetworkManager.Singleton.ConnectedClientsIds);
            people.Sort();
            ulong host = NetworkManager.ServerClientId;
            people.Remove(host);
            people.Insert(0, host);

            var used = new bool[slots.Count];
            int cursor = 0;
            if (Mode.Value == 0 && !Session.HostIsKiller) cursor = 1;
            foreach (var id in people)
            {
                while (cursor < slots.Count && used[cursor]) cursor++;
                if (cursor >= slots.Count) break;
                used[cursor] = true;
                var slot = slots[cursor];
                SpawnSlot(slot, false, id);
                cursor++;
            }
            for (int i = 0; i < slots.Count; i++)
            {
                if (used[i]) continue;
                SpawnSlot(slots[i], true, 0);
            }
        }

        struct RoleSpawn
        {
            public int Team;
            public int Kind;
            public int Number;
            public Vector3 Pos;
            public float Yaw;
        }

        void SpawnSlot(RoleSpawn slot, bool bot, ulong clientId)
        {
            var prefab = Resources.Load<GameObject>("Soldier");
            if (prefab == null)
            {
                Debug.LogError("Soldier 프리팹이 없습니다. 에디터 준비를 기다린 뒤 다시 플레이하세요.");
                return;
            }
            var go = Instantiate(prefab, slot.Pos, Quaternion.Euler(0f, slot.Yaw, 0f));
            var soldier = go.GetComponent<Soldier>();
            soldier.ServerPrepare(slot.Team, slot.Kind, slot.Number, bot);
            var net = go.GetComponent<NetworkObject>();
            if (bot) net.Spawn(true);
            else
            {
                net.SpawnAsPlayerObject(clientId, true);
                humans[clientId] = new Role { Team = slot.Team, Kind = slot.Kind, Number = slot.Number };
            }
        }

        void AssignCarrier()
        {
            Carrier.Value = ulong.MaxValue;
            if (Mode.Value != 2) return;
            Soldier human = null;
            Soldier bot = null;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (!soldier.Alive.Value || soldier.Kind.Value != 2) continue;
                if (!soldier.Bot.Value && human == null) human = soldier;
                if (soldier.Bot.Value && bot == null) bot = soldier;
            }
            var chosen = human != null ? human : bot;
            if (chosen != null) Carrier.Value = chosen.NetworkObjectId;
            BombState.Value = 0;
        }

        void Update()
        {
            if (!IsServer || Phase.Value != 1) return;
            float dt = Time.deltaTime;
            TimeLeft.Value = Mathf.Max(0f, TimeLeft.Value - dt);
            if (Mode.Value == 2) TickBomb(dt);
            tick -= dt;
            if (tick > 0f) return;
            tick = 0.25f;
            Evaluate();
        }

        void TickBomb(float dt)
        {
            if (BombState.Value == 2 || BombState.Value == 3)
            {
                fuse -= dt;
                ActionTime.Value = BombState.Value == 3 ? defuse : fuse;
                if (fuse <= 0f)
                {
                    EndRound(AttackTeam(), "신호탄 폭발");
                    return;
                }
                Soldier defuser = DefenderUsingSite(BombSite.Value);
                if (defuser != null)
                {
                    BombState.Value = 3;
                    defuse += dt;
                    ActionTime.Value = defuse;
                    if (defuse >= Rules.DefuseTime)
                        EndRound(DefendTeam(), "신호탄 해제");
                }
                else
                {
                    BombState.Value = 2;
                    defuse = 0f;
                }
                return;
            }

            if (BombState.Value == 4)
            {
                foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
                {
                    if (!soldier.Alive.Value || soldier.Kind.Value != 2) continue;
                    if (Vector3.Distance(soldier.transform.position, dropPoint) < 1.6f)
                    {
                        Carrier.Value = soldier.NetworkObjectId;
                        BombState.Value = 0;
                        break;
                    }
                }
            }

            Soldier carrier = FindCarrier();
            int site = carrier != null && carrier.ServerUse ? Arena.SiteAt(carrier.transform.position) : -1;
            if (carrier != null && site >= 0)
            {
                BombState.Value = 1;
                plant += dt;
                ActionTime.Value = plant;
                if (plant >= Rules.PlantTime)
                {
                    BombState.Value = 2;
                    BombSite.Value = site;
                    fuse = Rules.FuseTime;
                    defuse = 0f;
                    Carrier.Value = ulong.MaxValue;
                    plant = 0f;
                    BannerClientRpc(site == 0 ? "A 사이트 설치" : "B 사이트 설치");
                    FxClientRpc(site == 0 ? Arena.SiteA : Arena.SiteB);
                }
            }
            else if (BombState.Value == 1)
            {
                plant = 0f;
                BombState.Value = Carrier.Value == ulong.MaxValue ? 4 : 0;
                ActionTime.Value = 0f;
            }
        }

        int AttackTeam() => (!Swapped.Value) ? 0 : 1;
        int DefendTeam() => AttackTeam() == 0 ? 1 : 0;

        Soldier FindCarrier()
        {
            if (Carrier.Value == ulong.MaxValue) return null;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
                if (soldier.NetworkObjectId == Carrier.Value && soldier.Alive.Value) return soldier;
            return null;
        }

        Soldier DefenderUsingSite(int site)
        {
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (!soldier.Alive.Value || soldier.Kind.Value != 3 || !soldier.ServerUse) continue;
                if (Arena.SiteAt(soldier.transform.position) == site) return soldier;
            }
            return null;
        }

        void Evaluate()
        {
            int alive0 = 0, alive1 = 0;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (!soldier.Alive.Value) continue;
                if (soldier.TeamId.Value == 0) alive0++;
                else alive1++;
            }

            if (Mode.Value == 0)
            {
                if (alive0 == 0) EndRound(1, "시민 승리");
                else if (alive1 == 0) EndRound(0, "킬러 승리");
                else if (TimeLeft.Value <= 0f) EndRound(1, "시간 종료 · 시민 승리");
                return;
            }

            if (Mode.Value == 1)
            {
                if (alive0 == 0 && alive1 == 0) EndRound(-1, "무승부");
                else if (alive0 == 0) EndRound(1, "올리브 라운드 승리");
                else if (alive1 == 0) EndRound(0, "파랑 라운드 승리");
                else if (TimeLeft.Value <= 0f)
                {
                    if (alive0 > alive1) EndRound(0, "파랑 라운드 승리");
                    else if (alive1 > alive0) EndRound(1, "올리브 라운드 승리");
                    else EndRound(-1, "무승부");
                }
                return;
            }

            bool planted = BombState.Value == 2 || BombState.Value == 3;
            if (alive1 == 0 && DefendTeam() == 1) EndRound(AttackTeam(), "공격 승리");
            else if (alive0 == 0 && DefendTeam() == 0) EndRound(AttackTeam(), "공격 승리");
            else if (!planted && alive0 == 0 && AttackTeam() == 0) EndRound(DefendTeam(), "수비 승리");
            else if (!planted && alive1 == 0 && AttackTeam() == 1) EndRound(DefendTeam(), "수비 승리");
            else if (!planted && TimeLeft.Value <= 0f) EndRound(DefendTeam(), "시간 종료 · 수비 승리");
        }

        public void ReportDeath(Soldier victim, Soldier killer, bool backstab)
        {
            if (!IsServer) return;
            string how = backstab ? "등 뒤에서 처치" : "처치";
            string who = killer != null ? killer.Label() : "알 수 없음";
            FeedClientRpc(who + " → " + victim.Label() + " (" + how + ")");
            if (Mode.Value == 2 && victim.NetworkObjectId == Carrier.Value && BombState.Value != 2 && BombState.Value != 3)
            {
                dropPoint = victim.transform.position;
                Carrier.Value = ulong.MaxValue;
                BombState.Value = 4;
                plant = 0f;
            }
        }

        void EndRound(int winner, string text)
        {
            if (ending || Phase.Value != 1) return;
            ending = true;
            Phase.Value = 2;
            if (winner == 0) Score0.Value++;
            if (winner == 1) Score1.Value++;
            BannerClientRpc(text);
            StartCoroutine(AfterRound());
        }

        IEnumerator AfterRound()
        {
            yield return new WaitForSeconds(0.4f);
            var copy = new List<Soldier>(FindObjectsByType<Soldier>(FindObjectsSortMode.None));
            foreach (var soldier in copy)
            {
                if (soldier != null && soldier.IsSpawned)
                    soldier.NetworkObject.Despawn(true);
            }
            humans.Clear();
            yield return new WaitForSeconds(2.8f);
            if (Mode.Value == 0 || Score0.Value >= Rules.RoundsToWin || Score1.Value >= Rules.RoundsToWin)
            {
                Phase.Value = 3;
                if (Mode.Value != 0)
                    BannerClientRpc(Score0.Value == Score1.Value ? "무승부" : Score0.Value > Score1.Value ? "파랑 매치 승리" : "올리브 매치 승리");
                yield break;
            }
            yield return OpenRound(false);
        }

        public void ReplaceWithHuman(ulong clientId)
        {
            if (!IsServer || humans.ContainsKey(clientId)) return;
            if (Phase.Value != 1)
            {
                if (!pendingHumans.Contains(clientId)) pendingHumans.Add(clientId);
                return;
            }
            Soldier bot = null;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (soldier.Bot.Value && soldier.Alive.Value)
                {
                    bot = soldier;
                    break;
                }
            }
            if (bot == null) return;
            var slot = new RoleSpawn
            {
                Team = bot.TeamId.Value,
                Kind = bot.Kind.Value,
                Number = bot.Number.Value,
                Pos = bot.transform.position,
                Yaw = bot.transform.eulerAngles.y
            };
            if (Carrier.Value == bot.NetworkObjectId) Carrier.Value = ulong.MaxValue;
            bot.NetworkObject.Despawn(true);
            SpawnSlot(slot, false, clientId);
            if (Mode.Value == 2 && Carrier.Value == ulong.MaxValue && BombState.Value == 0)
                AssignCarrier();
        }

        void FlushPending()
        {
            var copy = new List<ulong>(pendingHumans);
            pendingHumans.Clear();
            foreach (var id in copy)
            {
                if (NetworkManager.Singleton.ConnectedClients.ContainsKey(id))
                    ReplaceWithHuman(id);
            }
        }

        public void ReplaceWithBot(ulong clientId)
        {
            if (!IsServer || !humans.TryGetValue(clientId, out var role)) return;
            humans.Remove(clientId);
            if (Phase.Value != 1) return;
            var slot = new RoleSpawn
            {
                Team = role.Team,
                Kind = role.Kind,
                Number = role.Number,
                Pos = role.Kind == 0 ? Arena.KillerSpawn : Arena.Waypoints[Random.Range(0, Arena.Waypoints.Length)],
                Yaw = 0f
            };
            SpawnSlot(slot, true, 0);
        }

        [ClientRpc]
        void BannerClientRpc(string text) => Banner = text;

        [ClientRpc]
        void FeedClientRpc(string line) => Hud.PushFeed(line);

        [ClientRpc]
        void FxClientRpc(Vector3 pos) => Fx.Play(pos, Fx.Beep, 0.9f);
    }
}

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sitefall
{
    public class FrontEnd : MonoBehaviour
    {
        public System.Action<int> OnMode;
        public System.Action<bool> OnRole;
        public System.Action OnHost;
        public System.Action<string> OnJoin;
        public System.Action OnLeave;

        RectTransform panel;
        Text title;
        Text info;
        InputField address;
        Slider sens;
        Slider volume;
        readonly List<GameObject> rows = new List<GameObject>();
        int page;
        bool huntRole = true;

        public void Build()
        {
            var canvasGo = new GameObject("Menu");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            canvasGo.AddComponent<GraphicRaycaster>();

            var panelGo = Widget("Panel", canvasGo.transform);
            panel = panelGo.GetComponent<RectTransform>();
            panel.anchorMin = new Vector2(0f, 0f);
            panel.anchorMax = new Vector2(0f, 1f);
            panel.pivot = new Vector2(0f, 0.5f);
            panel.sizeDelta = new Vector2(460f, 0f);
            panel.anchoredPosition = Vector2.zero;
            panelGo.GetComponent<Image>().color = new Color(0.06f, 0.07f, 0.09f, 0.94f);

            title = Label(panel, "사이트폴", 42, FontStyle.Bold, new Vector2(36f, -48f), new Vector2(380f, 64f));
            title.color = new Color(0.95f, 0.62f, 0.28f);
            info = Label(panel, "", 20, FontStyle.Normal, new Vector2(36f, -150f), new Vector2(380f, 80f));
            info.color = new Color(0.78f, 0.8f, 0.84f);
            info.alignment = TextAnchor.UpperLeft;

            var addressGo = Widget("Address", panel);
            var addressRect = addressGo.GetComponent<RectTransform>();
            addressRect.anchorMin = new Vector2(0f, 1f);
            addressRect.anchorMax = new Vector2(0f, 1f);
            addressRect.pivot = new Vector2(0f, 1f);
            addressRect.anchoredPosition = new Vector2(36f, -250f);
            addressRect.sizeDelta = new Vector2(380f, 48f);
            address = addressGo.AddComponent<InputField>();
            var addressText = Label(addressGo.transform, "127.0.0.1", 22, FontStyle.Normal, Vector2.zero, new Vector2(360f, 48f));
            addressText.alignment = TextAnchor.MiddleLeft;
            address.textComponent = addressText;
            address.text = Session.JoinAddress;
            addressGo.SetActive(false);

            sens = MakeSlider(panel, "민감도", -250f);
            volume = MakeSlider(panel, "소리", -330f);
            sens.gameObject.SetActive(false);
            volume.gameObject.SetActive(false);
            sens.value = Session.Sensitivity / 8f;
            volume.value = Session.Volume;
            sens.onValueChanged.AddListener(value =>
            {
                Session.Sensitivity = Mathf.Lerp(0.4f, 8f, value);
                Session.Save();
            });
            volume.onValueChanged.AddListener(value =>
            {
                Session.Volume = value;
                Session.Save();
            });

            ShowHome();
        }

        public void ShowHome() => Show(0);
        public void ShowPause() => Show(5);

        public void SetStatus(string text)
        {
            if (info != null) info.text = text;
        }

        void Show(int next)
        {
            page = next;
            foreach (var row in rows) Destroy(row);
            rows.Clear();
            address.gameObject.SetActive(false);
            sens.gameObject.SetActive(false);
            volume.gameObject.SetActive(false);
            float y = -250f;
            if (next == 0)
            {
                title.text = "사이트폴";
                info.text = "한 명이 방을 만들고, 나머지는 IP로 참가합니다.\n빈자리는 AI가 채웁니다.";
                y = AddButton("플레이", y, () => Show(1));
                y = AddButton("설정", y, () => Show(4));
                y = AddButton("나가기", y, () => Application.Quit());
            }
            else if (next == 1)
            {
                title.text = "모드";
                info.text = "사냥은 킬러 1, 시민 10.\n섬멸과 신호 설치는 5대 5.";
                y = AddButton("사냥", y, () => Show(2));
                y = AddButton("섬멸  5대 5", y, () => { Session.Mode = 1; Show(3); });
                y = AddButton("신호 설치", y, () => { Session.Mode = 2; Show(3); });
                y = AddButton("뒤로", y, () => Show(0));
            }
            else if (next == 2)
            {
                title.text = "사냥";
                info.text = "킬러 소총: 머리 100, 몸 50, 다리 25.\n시민 단검: 등 뒤는 한방.";
                y = AddButton(huntRole ? "역할  킬러" : "역할  시민", y, () =>
                {
                    huntRole = !huntRole;
                    Show(2);
                });
                y = AddButton("다음", y, () =>
                {
                    Session.Mode = 0;
                    Session.HostIsKiller = huntRole;
                    Show(3);
                });
                y = AddButton("뒤로", y, () => Show(1));
            }
            else if (next == 3)
            {
                title.text = "접속";
                info.text = "포트 " + Rules.Port + "  ·  UDP\n같은 네트워크의 IP를 입력하세요.";
                address.gameObject.SetActive(true);
                y = -320f;
                y = AddButton("방 만들기", y, () => OnHost?.Invoke());
                y = AddButton("참가", y, () =>
                {
                    Session.JoinAddress = string.IsNullOrWhiteSpace(address.text) ? "127.0.0.1" : address.text.Trim();
                    OnJoin?.Invoke(Session.JoinAddress);
                });
                y = AddButton("뒤로", y, () => Show(Session.Mode == 0 ? 2 : 1));
            }
            else if (next == 4)
            {
                title.text = "설정";
                info.text = "마우스 민감도와 소리.";
                sens.gameObject.SetActive(true);
                volume.gameObject.SetActive(true);
                y = -430f;
                y = AddButton("뒤로", y, () => Show(0));
            }
            else if (next == 5)
            {
                title.text = "일시정지";
                info.text = "Esc로 돌아갑니다.";
                sens.gameObject.SetActive(true);
                volume.gameObject.SetActive(true);
                y = -430f;
                y = AddButton("계속", y, () =>
                {
                    panel.gameObject.SetActive(false);
                    Cursor.lockState = CursorLockMode.Locked;
                    Cursor.visible = false;
                });
                y = AddButton("메인 메뉴", y, () => OnLeave?.Invoke());
            }
        }

        float AddButton(string text, float y, UnityEngine.Events.UnityAction action)
        {
            var go = Widget(text, panel);
            var rect = go.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(36f, y);
            rect.sizeDelta = new Vector2(380f, 58f);
            go.GetComponent<Image>().color = new Color(0.14f, 0.15f, 0.18f, 1f);
            var button = go.AddComponent<Button>();
            button.targetGraphic = go.GetComponent<Image>();
            var colors = button.colors;
            colors.highlightedColor = new Color(0.85f, 0.5f, 0.22f, 1f);
            colors.pressedColor = new Color(0.7f, 0.38f, 0.14f, 1f);
            colors.normalColor = Color.white;
            button.colors = colors;
            button.onClick.AddListener(action);
            var label = Label(go.transform, text, 24, FontStyle.Bold, new Vector2(16f, 0f), new Vector2(348f, 58f));
            label.alignment = TextAnchor.MiddleLeft;
            rows.Add(go);
            return y - 70f;
        }

        Slider MakeSlider(Transform parent, string caption, float y)
        {
            var go = Widget(caption, parent);
            var rect = go.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(36f, y);
            rect.sizeDelta = new Vector2(380f, 64f);
            go.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var captionText = Label(go.transform, caption, 20, FontStyle.Normal, new Vector2(0f, 0f), new Vector2(200f, 28f));
            captionText.alignment = TextAnchor.MiddleLeft;
            var track = Widget("Track", go.transform);
            var trackRect = track.GetComponent<RectTransform>();
            trackRect.anchorMin = new Vector2(0f, 1f);
            trackRect.anchorMax = new Vector2(0f, 1f);
            trackRect.pivot = new Vector2(0f, 1f);
            trackRect.anchoredPosition = new Vector2(0f, -32f);
            trackRect.sizeDelta = new Vector2(380f, 18f);
            track.GetComponent<Image>().color = new Color(0.2f, 0.21f, 0.24f, 1f);
            var slider = go.AddComponent<Slider>();
            var fill = Widget("Fill", track.transform);
            var fillRect = fill.GetComponent<RectTransform>();
            fillRect.anchorMin = Vector2.zero;
            fillRect.anchorMax = Vector2.one;
            fillRect.offsetMin = Vector2.zero;
            fillRect.offsetMax = Vector2.zero;
            fill.GetComponent<Image>().color = new Color(0.9f, 0.55f, 0.24f, 1f);
            slider.fillRect = fillRect;
            slider.targetGraphic = track.GetComponent<Image>();
            slider.minValue = 0f;
            slider.maxValue = 1f;
            return slider;
        }

        public void Hide() => panel.gameObject.SetActive(false);
        public void Reveal() { panel.gameObject.SetActive(true); Show(0); }
        public bool Visible => panel != null && panel.gameObject.activeSelf;

        static GameObject Widget(string name, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var image = go.AddComponent<Image>();
            image.sprite = Palette.White;
            image.color = Color.white;
            return go;
        }

        static Text Label(Transform parent, string text, int size, FontStyle style, Vector2 pos, Vector2 sizeDelta)
        {
            var go = new GameObject(text);
            go.transform.SetParent(parent, false);
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = pos;
            rect.sizeDelta = sizeDelta;
            var label = go.AddComponent<Text>();
            label.font = Palette.Font;
            label.fontSize = size;
            label.fontStyle = style;
            label.color = new Color(0.93f, 0.94f, 0.96f);
            label.alignment = TextAnchor.MiddleLeft;
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            label.text = text;
            return label;
        }
    }

    public class Hud : MonoBehaviour
    {
        static readonly List<string> feed = new List<string>();
        static float hitFlash;

        Text top;
        Text status;
        Text feedText;
        Text hint;
        Image hpFill;
        Image crosshair;
        Image hit;
        RectTransform root;

        public static void PushFeed(string line)
        {
            feed.Insert(0, line);
            if (feed.Count > 4) feed.RemoveAt(feed.Count - 1);
        }

        public static void MarkHit() => hitFlash = 0.18f;

        public void Build()
        {
            var canvasGo = new GameObject("Hud");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 5;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            root = canvasGo.GetComponent<RectTransform>();

            top = Make(canvasGo.transform, 26, TextAnchor.UpperCenter, new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(900f, 40f));
            status = Make(canvasGo.transform, 22, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(24f, -24f), new Vector2(520f, 140f));
            hint = Make(canvasGo.transform, 20, TextAnchor.LowerCenter, new Vector2(0.5f, 0f), new Vector2(0f, 36f), new Vector2(900f, 36f));
            feedText = Make(canvasGo.transform, 20, TextAnchor.UpperRight, new Vector2(1f, 1f), new Vector2(-24f, -24f), new Vector2(520f, 140f));

            var back = Bar(canvasGo.transform, new Vector2(24f, 28f), new Vector2(320f, 18f), new Color(0.1f, 0.1f, 0.12f, 0.8f));
            hpFill = Bar(back.transform, Vector2.zero, new Vector2(320f, 18f), new Color(0.82f, 0.28f, 0.22f, 1f));
            var fillRect = hpFill.rectTransform;
            fillRect.anchorMin = Vector2.zero;
            fillRect.anchorMax = Vector2.one;
            fillRect.offsetMin = Vector2.zero;
            fillRect.offsetMax = Vector2.zero;
            hpFill.type = Image.Type.Filled;
            hpFill.fillMethod = Image.FillMethod.Horizontal;

            crosshair = Dot(canvasGo.transform, 4f, new Color(1f, 1f, 1f, 0.9f));
            hit = Dot(canvasGo.transform, 10f, new Color(1f, 0.35f, 0.25f, 0f));
        }

        void Update()
        {
            var match = Match.Instance;
            var local = LocalPlayer();
            bool show = match != null && match.Phase.Value != 0;
            root.gameObject.SetActive(show);
            if (!show) return;

            int alive0 = 0, alive1 = 0;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (!soldier.Alive.Value) continue;
                if (soldier.TeamId.Value == 0) alive0++;
                else alive1++;
            }

            string clock = Format(match.TimeLeft.Value);
            if (match.Mode.Value == 0)
                top.text = "사냥   " + clock + "   킬러 " + alive0 + "  ·  시민 " + alive1;
            else
                top.text = (match.Mode.Value == 1 ? "섬멸" : "신호") + "   " + clock + "    파랑 " + match.Score0.Value + "  :  " + match.Score1.Value + " 올리브";

            if (local == null || !local.Alive.Value)
            {
                status.text = match.Phase.Value == 3 ? "매치 종료" : "관전";
                hpFill.fillAmount = 0f;
                hint.text = match.Banner;
            }
            else
            {
                hpFill.fillAmount = local.Health.Value / Rules.Health;
                string weapon = local.HasRifle.Value
                    ? (local.Reloading.Value ? "재장전" : "탄약 " + local.Ammo.Value + " / " + Rules.Magazine)
                    : "단검";
                status.text = local.Label() + "\n체력 " + Mathf.CeilToInt(local.Health.Value) + "\n" + weapon;
                if (local.Kind.Value == 1) hint.text = "등 뒤에서 단검 한방  ·  F";
                else if (local.Kind.Value == 0) hint.text = "머리 100   몸 50   다리 25";
                else hint.text = local.Kind.Value == 2 ? "E 설치  ·  F 단검  ·  R 재장전" : "E 해제  ·  F 단검  ·  R 재장전";
                if (match.Mode.Value == 2)
                    hint.text = BombLine(match, local) + "\n" + hint.text;
            }

            if (!string.IsNullOrEmpty(match.Banner) && match.Phase.Value != 1)
                top.text = match.Banner;

            feedText.text = string.Join("\n", feed);
            hitFlash = Mathf.Max(0f, hitFlash - Time.deltaTime);
            if (hit != null) hit.color = new Color(1f, 0.4f, 0.3f, hitFlash > 0f ? 0.95f : 0f);
            if (crosshair != null) crosshair.enabled = local != null && local.Alive.Value && Cursor.lockState == CursorLockMode.Locked;
        }

        static string BombLine(Match match, Soldier local)
        {
            if (match.BombState.Value == 2) return "폭발까지 " + Format(match.ActionTime.Value);
            if (match.BombState.Value == 3) return "해제 " + Mathf.CeilToInt(match.ActionTime.Value) + " / 7";
            if (match.BombState.Value == 1) return "설치 " + Mathf.CeilToInt(match.ActionTime.Value) + " / 4";
            if (match.BombState.Value == 4) return "신호탄이 떨어져 있습니다";
            if (local.NetworkObjectId == match.Carrier.Value) return "신호탄 보유";
            return "사이트 A / B";
        }

        static string Format(float seconds)
        {
            int s = Mathf.CeilToInt(seconds);
            return (s / 60) + ":" + (s % 60).ToString("00");
        }

        public static Soldier LocalPlayer()
        {
            if (Unity.Netcode.NetworkManager.Singleton == null) return null;
            foreach (var soldier in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
                if (soldier.IsOwner && !soldier.Bot.Value) return soldier;
            return null;
        }

        static Text Make(Transform parent, int size, TextAnchor align, Vector2 anchor, Vector2 pos, Vector2 sizeDelta)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = sizeDelta;
            var text = go.AddComponent<Text>();
            text.font = Palette.Font;
            text.fontSize = size;
            text.alignment = align;
            text.color = Color.white;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        static Image Bar(Transform parent, Vector2 pos, Vector2 size, Color color)
        {
            var go = new GameObject("Bar");
            go.transform.SetParent(parent, false);
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0f, 0f);
            rect.anchorMax = new Vector2(0f, 0f);
            rect.pivot = new Vector2(0f, 0f);
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;
            var image = go.AddComponent<Image>();
            image.sprite = Palette.White;
            image.color = color;
            return image;
        }

        static Image Dot(Transform parent, float size, Color color)
        {
            var go = new GameObject("Dot");
            go.transform.SetParent(parent, false);
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = new Vector2(size, size);
            var image = go.AddComponent<Image>();
            image.sprite = Palette.White;
            image.color = color;
            return image;
        }
    }
}

using System.IO;
using Unity.Netcode;
using UnityEditor;
using UnityEngine;

namespace Sitefall.EditorTools
{
    public static class ProjectSetup
    {
        [InitializeOnLoadMethod]
        static void AfterLoad()
        {
            EditorApplication.delayCall += Ensure;
        }

        [MenuItem("사이트폴/프리팹 준비")]
        public static void Ensure()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            Directory.CreateDirectory("Assets/Resources");
            if (!File.Exists("Assets/Resources/Soldier.prefab"))
                WritePrefab("Assets/Resources/Soldier.prefab", true);
            if (!File.Exists("Assets/Resources/Match.prefab"))
                WritePrefab("Assets/Resources/Match.prefab", false);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            PlayerSettings.companyName = "Sitefall";
            PlayerSettings.productName = "Sitefall";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.runInBackground = true;
        }

        static void WritePrefab(string path, bool soldier)
        {
            var go = new GameObject(soldier ? "Soldier" : "Match");
            var net = go.AddComponent<NetworkObject>();
            if (soldier)
            {
                var body = go.AddComponent<CharacterController>();
                body.height = 1.8f;
                body.radius = 0.32f;
                body.center = new Vector3(0f, 0.9f, 0f);
                go.AddComponent<Soldier>();
                go.AddComponent<Brain>();
                var audio = go.AddComponent<AudioSource>();
                audio.spatialBlend = 0.6f;
                audio.playOnAwake = false;
            }
            else go.AddComponent<Match>();

            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            if (prefab == null) return;
            var saved = prefab.GetComponent<NetworkObject>();
            var serialized = new SerializedObject(saved);
            var hash = serialized.FindProperty("GlobalObjectIdHash");
            if (hash != null && hash.longValue == 0)
            {
                uint value = soldier ? 0x51FEA11u : 0x51FEA22u;
                hash.longValue = value;
                serialized.ApplyModifiedPropertiesWithoutUndo();
            }
            EditorUtility.SetDirty(prefab);
        }

        [MenuItem("사이트폴/Linux 빌드")]
        public static void BuildLinux() => Build(BuildTarget.StandaloneLinux64, "Builds/Linux/Sitefall.x86_64");

        [MenuItem("사이트폴/Windows 빌드")]
        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Sitefall.exe");

        public static void BuildLinuxBatch()
        {
            Ensure();
            EditorApplication.Exit(Build(BuildTarget.StandaloneLinux64, "Builds/Linux/Sitefall.x86_64"));
        }

        public static void BuildWindowsBatch()
        {
            Ensure();
            EditorApplication.Exit(Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Sitefall.exe"));
        }

        public static int Build(BuildTarget target, string path)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path) ?? "Builds");
            var options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/Main.unity" },
                locationPathName = path,
                target = target,
                options = BuildOptions.None
            };
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log("빌드 결과 " + report.summary.result + " → " + path);
            return report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1;
        }
    }
}

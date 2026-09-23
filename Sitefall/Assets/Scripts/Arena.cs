using UnityEngine;

namespace Sitefall
{
    public class SiteMarker : MonoBehaviour
    {
        public int Id;
    }

    public static class Arena
    {
        public static GameObject Root;
        public static readonly Vector3[] AttackSpawns = new Vector3[5];
        public static readonly Vector3[] DefenseSpawns = new Vector3[5];
        public static readonly Vector3[] CitizenSpawns = new Vector3[10];
        public static readonly Vector3[] Waypoints = new Vector3[14];
        public static Vector3 KillerSpawn;
        public static Vector3 SiteA = new Vector3(-16f, 0f, 8f);
        public static Vector3 SiteB = new Vector3(16f, 0f, 8f);

        public static void Build()
        {
            if (Root != null) return;
            Root = new GameObject("Arena");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = 0.014f;
            RenderSettings.fogColor = new Color(0.55f, 0.58f, 0.62f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.66f, 0.72f);
            RenderSettings.ambientEquatorColor = new Color(0.42f, 0.43f, 0.45f);
            RenderSettings.ambientGroundColor = new Color(0.22f, 0.21f, 0.2f);

            var concrete = Palette.Mat(new Color(0.48f, 0.49f, 0.51f), 0.18f);
            var concreteDark = Palette.Mat(new Color(0.32f, 0.33f, 0.35f), 0.2f);
            var wall = Palette.Mat(new Color(0.38f, 0.39f, 0.41f), 0.22f);
            var trim = Palette.Mat(new Color(0.22f, 0.24f, 0.27f), 0.45f, 0.35f);
            var crate = Palette.Mat(new Color(0.42f, 0.3f, 0.18f), 0.25f);
            var crate2 = Palette.Mat(new Color(0.33f, 0.36f, 0.38f), 0.4f, 0.25f);
            var siteA = Palette.Mat(new Color(0.85f, 0.42f, 0.16f), 0.35f);
            var siteB = Palette.Mat(new Color(0.2f, 0.55f, 0.72f), 0.35f);
            var line = Palette.Mat(new Color(0.85f, 0.78f, 0.35f), 0.4f);

            Box("Floor", new Vector3(0f, -0.25f, 0f), new Vector3(56f, 0.5f, 44f), concrete);
            for (int i = -4; i <= 4; i++)
                Box("Lane", new Vector3(i * 6f, 0.01f, 0f), new Vector3(0.12f, 0.02f, 36f), line);

            WallBox(new Vector3(0f, 2f, 21.2f), new Vector3(56f, 4f, 0.7f), wall);
            WallBox(new Vector3(0f, 2f, -21.2f), new Vector3(56f, 4f, 0.7f), wall);
            WallBox(new Vector3(27.2f, 2f, 0f), new Vector3(0.7f, 4f, 44f), wall);
            WallBox(new Vector3(-27.2f, 2f, 0f), new Vector3(0.7f, 4f, 44f), wall);
            Box("TrimN", new Vector3(0f, 3.9f, 21.2f), new Vector3(56f, 0.25f, 0.9f), trim);
            Box("TrimS", new Vector3(0f, 3.9f, -21.2f), new Vector3(56f, 0.25f, 0.9f), trim);

            Room(-16f, 8f, siteA, "A");
            Room(16f, 8f, siteB, "B");
            SiteZone(0, SiteA, siteA);
            SiteZone(1, SiteB, siteB);

            Box("MidCrate", new Vector3(0f, 0.6f, 0f), new Vector3(2.2f, 1.2f, 2.2f), crate);
            Box("CrateL", new Vector3(-5.5f, 0.5f, -2.5f), new Vector3(1.6f, 1f, 1.4f), crate2);
            Box("CrateR", new Vector3(6f, 0.7f, 2.2f), new Vector3(1.8f, 1.4f, 1.5f), crate);
            Box("LowWall", new Vector3(0f, 0.55f, -8f), new Vector3(7f, 1.1f, 0.45f), concreteDark);
            Box("PillarL", new Vector3(-8f, 1.5f, 4f), new Vector3(0.8f, 3f, 0.8f), trim);
            Box("PillarR", new Vector3(8f, 1.5f, 4f), new Vector3(0.8f, 3f, 0.8f), trim);
            Box("BarrierL", new Vector3(-12f, 0.5f, -10f), new Vector3(3.2f, 1f, 0.5f), crate2);
            Box("BarrierR", new Vector3(12f, 0.5f, -10f), new Vector3(3.2f, 1f, 0.5f), crate2);
            Box("LaneCover", new Vector3(-22f, 0.55f, 0f), new Vector3(0.5f, 1.1f, 6f), concreteDark);
            Box("LaneCover2", new Vector3(22f, 0.55f, -4f), new Vector3(0.5f, 1.1f, 5f), concreteDark);

            for (int i = -2; i <= 2; i++)
            {
                Box("Sky", new Vector3(i * 14f, 6f, 30f), new Vector3(8f, 10f, 4f), Palette.Mat(new Color(0.25f, 0.27f, 0.3f), 0.2f));
                Box("Sky2", new Vector3(i * 16f, 5f, -30f), new Vector3(7f, 8f, 4f), Palette.Mat(new Color(0.22f, 0.23f, 0.26f), 0.2f));
            }

            Light(new Vector3(-16f, 3.2f, 8f), new Color(1f, 0.62f, 0.35f), 10f, 1.4f);
            Light(new Vector3(16f, 3.2f, 8f), new Color(0.45f, 0.75f, 1f), 10f, 1.4f);
            Light(new Vector3(0f, 3.4f, 0f), new Color(1f, 0.94f, 0.85f), 14f, 1.1f);

            KillerSpawn = new Vector3(0f, 0.05f, -16f);
            for (int i = 0; i < 5; i++)
            {
                float x = (i - 2) * 2.4f;
                AttackSpawns[i] = new Vector3(x, 0.05f, -16.5f);
                DefenseSpawns[i] = new Vector3(x, 0.05f, 15.5f);
            }
            Vector3[] citizens =
            {
                new Vector3(-18f, 0.05f, 2f), new Vector3(18f, 0.05f, 2f),
                new Vector3(-16f, 0.05f, 12f), new Vector3(16f, 0.05f, 12f),
                new Vector3(-8f, 0.05f, 10f), new Vector3(8f, 0.05f, -6f),
                new Vector3(-22f, 0.05f, -8f), new Vector3(22f, 0.05f, 8f),
                new Vector3(0f, 0.05f, 6f), new Vector3(-4f, 0.05f, -4f)
            };
            for (int i = 0; i < 10; i++) CitizenSpawns[i] = citizens[i];

            Vector3[] points =
            {
                new Vector3(0f, 0.05f, 0f), new Vector3(-8f, 0.05f, -6f), new Vector3(8f, 0.05f, -6f),
                new Vector3(-16f, 0.05f, 2f), new Vector3(16f, 0.05f, 2f), new Vector3(-16f, 0.05f, 10f),
                new Vector3(16f, 0.05f, 10f), new Vector3(0f, 0.05f, -14f), new Vector3(0f, 0.05f, 14f),
                new Vector3(-22f, 0.05f, 0f), new Vector3(22f, 0.05f, 0f), new Vector3(-6f, 0.05f, 8f),
                new Vector3(6f, 0.05f, 8f), new Vector3(0f, 0.05f, -4f)
            };
            for (int i = 0; i < points.Length; i++) Waypoints[i] = points[i];
        }

        static void Room(float x, float z, Material accent, string label)
        {
            var wall = Palette.Mat(new Color(0.34f, 0.35f, 0.37f), 0.25f);
            Box(label + "Back", new Vector3(x, 1.6f, z + 5.2f), new Vector3(10f, 3.2f, 0.45f), wall);
            Box(label + "SideL", new Vector3(x - 5f, 1.6f, z), new Vector3(0.45f, 3.2f, 10f), wall);
            Box(label + "SideR", new Vector3(x + 5f, 1.6f, z), new Vector3(0.45f, 3.2f, 10f), wall);
            Box(label + "FrontL", new Vector3(x - 3.4f, 1.6f, z - 5.2f), new Vector3(3.2f, 3.2f, 0.45f), wall);
            Box(label + "FrontR", new Vector3(x + 3.4f, 1.6f, z - 5.2f), new Vector3(3.2f, 3.2f, 0.45f), wall);
            Box(label + "Lintel", new Vector3(x, 2.9f, z - 5.2f), new Vector3(3.6f, 0.6f, 0.45f), wall);
            Box(label + "Mark", new Vector3(x, 2.2f, z - 5.5f), new Vector3(1.2f, 1.2f, 0.08f), accent);
        }

        static void SiteZone(int id, Vector3 pos, Material accent)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = id == 0 ? "SiteA" : "SiteB";
            go.transform.SetParent(Root.transform, false);
            go.transform.position = pos + Vector3.up * 0.04f;
            go.transform.localScale = new Vector3(4.2f, 0.08f, 4.2f);
            var col = go.GetComponent<BoxCollider>();
            col.isTrigger = true;
            col.size = new Vector3(1f, 20f, 1f);
            go.GetComponent<Renderer>().sharedMaterial = accent;
            var marker = go.AddComponent<SiteMarker>();
            marker.Id = id;
        }

        public static int SiteAt(Vector3 pos)
        {
            var hits = Physics.OverlapSphere(pos + Vector3.up * 0.4f, 0.45f, ~0, QueryTriggerInteraction.Collide);
            int found = -1;
            foreach (var hit in hits)
            {
                var site = hit.GetComponent<SiteMarker>();
                if (site != null) found = site.Id;
            }
            return found;
        }

        static void WallBox(Vector3 pos, Vector3 scale, Material mat) => Box("Wall", pos, scale, mat);

        static void Box(string name, Vector3 pos, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(Root.transform, false);
            go.transform.position = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = mat;
            go.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            go.isStatic = true;
        }

        static void Light(Vector3 pos, Color color, float range, float intensity)
        {
            var go = new GameObject("Lamp");
            go.transform.SetParent(Root.transform, false);
            go.transform.position = pos;
            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = color;
            light.range = range;
            light.intensity = intensity;
            light.shadows = LightShadows.Soft;
        }

        public static void Clear()
        {
            if (Root != null) Object.Destroy(Root);
            Root = null;
        }
    }
}

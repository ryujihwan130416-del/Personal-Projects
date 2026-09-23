using System.Collections.Generic;
using UnityEngine;

namespace Sitefall
{
    public static class Fx
    {
        static AudioClip shot;
        static AudioClip stab;
        static AudioClip hit;
        static AudioClip beep;
        static readonly List<GameObject> marks = new List<GameObject>();

        public static AudioClip Shot => shot ??= Noise(0.12f, (t, n) => (n * 2f - 1f) * Mathf.Exp(-t * 28f));
        public static AudioClip Stab => stab ??= Noise(0.1f, (t, n) => Mathf.Sin(t * 180f) * Mathf.Exp(-t * 22f) * 0.8f);
        public static AudioClip Hit => hit ??= Noise(0.08f, (t, n) => (n * 2f - 1f) * Mathf.Exp(-t * 40f) * 0.6f);
        public static AudioClip Beep => beep ??= Noise(0.16f, (t, n) => Mathf.Sin(t * 880f * Mathf.PI * 2f) * Mathf.Exp(-t * 8f) * 0.35f);

        static AudioClip Noise(float duration, System.Func<float, float, float> sample)
        {
            const int rate = 22050;
            int count = Mathf.CeilToInt(rate * duration);
            var clip = AudioClip.Create("fx", count, 1, rate, false);
            var data = new float[count];
            var rng = new System.Random(count);
            for (int i = 0; i < count; i++)
                data[i] = Mathf.Clamp(sample(i / (float)rate, (float)rng.NextDouble()), -1f, 1f);
            clip.SetData(data, 0);
            return clip;
        }

        public static void Play(Vector3 pos, AudioClip clip, float volume = 1f)
        {
            if (clip == null) return;
            var go = new GameObject("sfx");
            go.transform.position = pos;
            var source = go.AddComponent<AudioSource>();
            source.clip = clip;
            source.spatialBlend = 0.4f;
            source.volume = volume;
            source.Play();
            Object.Destroy(go, clip.length + 0.05f);
        }

        public static void Tracer(Vector3 from, Vector3 to)
        {
            var go = new GameObject("tracer");
            var line = go.AddComponent<LineRenderer>();
            line.positionCount = 2;
            line.SetPosition(0, from);
            line.SetPosition(1, to);
            line.startWidth = 0.025f;
            line.endWidth = 0.01f;
            line.material = Palette.Mat(new Color(1f, 0.85f, 0.45f), 0.8f, 0.2f);
            line.startColor = new Color(1f, 0.9f, 0.5f, 1f);
            line.endColor = new Color(1f, 0.6f, 0.2f, 0.2f);
            var lamp = go.AddComponent<Light>();
            lamp.type = LightType.Point;
            lamp.color = new Color(1f, 0.75f, 0.4f);
            lamp.range = 3.5f;
            lamp.intensity = 2.2f;
            lamp.transform.position = from;
            Object.Destroy(go, 0.05f);

            var mark = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(mark.GetComponent<Collider>());
            mark.transform.position = to + (from - to).normalized * 0.02f;
            mark.transform.localScale = Vector3.one * 0.06f;
            mark.GetComponent<Renderer>().sharedMaterial = Palette.Mat(new Color(0.15f, 0.15f, 0.16f), 0.1f);
            marks.Add(mark);
            if (marks.Count > 30)
            {
                if (marks[0] != null) Object.Destroy(marks[0]);
                marks.RemoveAt(0);
            }
            Object.Destroy(mark, 8f);
        }
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace Sitefall
{
    public static class Palette
    {
        static Shader shader;
        static readonly Dictionary<int, Material> cache = new Dictionary<int, Material>();
        static Sprite white;

        public static Shader Shader
        {
            get
            {
                if (shader != null) return shader;
                shader = Shader.Find("Standard")
                    ?? Shader.Find("Universal Render Pipeline/Lit")
                    ?? Shader.Find("HDRP/Lit")
                    ?? Shader.Find("Unlit/Color")
                    ?? Shader.Find("Sprites/Default");
                return shader;
            }
        }

        public static Material Mat(Color color, float smooth = 0.35f, float metal = 0f)
        {
            Color32 c = color;
            int key = (c.r << 24) | (c.g << 16) | (c.b << 8) | c.a;
            key ^= Mathf.RoundToInt(smooth * 40f) << 1;
            key ^= Mathf.RoundToInt(metal * 40f) << 17;
            if (cache.TryGetValue(key, out var existing)) return existing;
            var material = new Material(Shader);
            if (material.HasProperty("_Color")) material.color = color;
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Glossiness")) material.SetFloat("_Glossiness", smooth);
            if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metal);
            if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", smooth);
            cache[key] = material;
            return material;
        }

        public static Sprite White
        {
            get
            {
                if (white != null) return white;
                var tex = new Texture2D(1, 1, TextureFormat.RGBA32, false);
                tex.SetPixel(0, 0, Color.white);
                tex.Apply();
                white = Sprite.Create(tex, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), 1f);
                return white;
            }
        }

        static Font font;
        public static Font Font
        {
            get
            {
                if (font != null) return font;
                font = Resources.Load<Font>("NanumGothic-Regular");
                if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                return font;
            }
        }

        public static readonly Color[] Hoodies =
        {
            new Color(0.45f, 0.28f, 0.24f),
            new Color(0.28f, 0.36f, 0.48f),
            new Color(0.36f, 0.40f, 0.30f),
            new Color(0.42f, 0.34f, 0.42f),
            new Color(0.32f, 0.32f, 0.34f),
            new Color(0.48f, 0.40f, 0.28f),
            new Color(0.26f, 0.38f, 0.38f),
            new Color(0.40f, 0.26f, 0.28f),
            new Color(0.34f, 0.34f, 0.42f),
            new Color(0.38f, 0.36f, 0.30f)
        };
    }
}

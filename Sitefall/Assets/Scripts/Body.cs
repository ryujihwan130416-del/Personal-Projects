using UnityEngine;

namespace Sitefall
{
    public class BodyRig : MonoBehaviour
    {
        public Transform Visual;
        public Transform Hips;
        public Transform Spine;
        public Transform Chest;
        public Transform Head;
        public Transform ArmUL, ArmLL, HandL;
        public Transform ArmUR, ArmLR, HandR;
        public Transform LegUL, LegLL, FootL;
        public Transform LegUR, LegLR, FootR;
        public Transform Gun;
        public GameObject HeadObject;
        public bool Rifle;
        public int Style;

        public float Phase;
        public float Shoot;
        public float Slash;
        public float Reload;
        public float Death;
        public bool Planting;
        public float AimPitch;

        public void SetFirstPerson(bool on)
        {
            if (HeadObject != null) HeadObject.SetActive(!on);
        }
    }

    public static class BodyBuilder
    {
        public static BodyRig Create(Transform parent, int style, bool rifle, int colorIndex)
        {
            var root = new GameObject("Body");
            root.transform.SetParent(parent, false);
            var rig = root.AddComponent<BodyRig>();
            rig.Style = style;
            rig.Rifle = rifle;
            rig.Visual = NewBone(root.transform, "Visual", Vector3.zero);

            Color cloth, clothDark, pants, skin, accent, boot;
            bool coat = style == 0;
            bool helmet = style == 0 || style == 2;
            if (style == 0)
            {
                cloth = new Color(0.07f, 0.07f, 0.08f);
                clothDark = new Color(0.04f, 0.04f, 0.05f);
                pants = new Color(0.08f, 0.08f, 0.09f);
                accent = new Color(0.65f, 0.12f, 0.12f);
                boot = new Color(0.05f, 0.05f, 0.05f);
            }
            else if (style == 2)
            {
                cloth = new Color(0.13f, 0.22f, 0.42f);
                clothDark = new Color(0.08f, 0.14f, 0.28f);
                pants = new Color(0.12f, 0.14f, 0.18f);
                accent = new Color(0.75f, 0.62f, 0.32f);
                boot = new Color(0.1f, 0.1f, 0.12f);
            }
            else if (style == 3)
            {
                cloth = new Color(0.34f, 0.38f, 0.22f);
                clothDark = new Color(0.22f, 0.26f, 0.14f);
                pants = new Color(0.28f, 0.26f, 0.18f);
                accent = new Color(0.72f, 0.55f, 0.28f);
                boot = new Color(0.18f, 0.14f, 0.1f);
            }
            else
            {
                cloth = Palette.Hoodies[Mathf.Abs(colorIndex) % Palette.Hoodies.Length];
                clothDark = cloth * 0.72f;
                pants = new Color(0.22f, 0.28f, 0.40f);
                accent = new Color(0.82f, 0.82f, 0.78f);
                boot = new Color(0.15f, 0.15f, 0.16f);
            }
            skin = new Color(0.62f, 0.48f, 0.38f);

            rig.Hips = NewBone(rig.Visual, "Hips", new Vector3(0f, 0.98f, 0f));
            Mesh(rig.Hips, PrimitiveType.Cube, Vector3.zero, new Vector3(0.32f, 0.16f, 0.2f), Palette.Mat(pants, 0.25f));

            rig.Spine = NewBone(rig.Hips, "Spine", new Vector3(0f, 0.16f, 0f));
            Mesh(rig.Spine, PrimitiveType.Cube, new Vector3(0f, 0.08f, 0f), new Vector3(0.36f, 0.26f, 0.2f), Palette.Mat(cloth, 0.28f));

            rig.Chest = NewBone(rig.Spine, "Chest", new Vector3(0f, 0.24f, 0f));
            Mesh(rig.Chest, PrimitiveType.Cube, new Vector3(0f, 0.05f, 0.02f), new Vector3(0.44f, 0.24f, 0.24f), Palette.Mat(clothDark, 0.32f));
            if (style == 2 || style == 3)
                Mesh(rig.Chest, PrimitiveType.Cube, new Vector3(0f, 0.02f, 0.12f), new Vector3(0.28f, 0.18f, 0.06f), Palette.Mat(accent, 0.4f, 0.15f));
            if (coat)
            {
                Mesh(rig.Chest, PrimitiveType.Cube, new Vector3(0f, -0.42f, -0.04f), new Vector3(0.48f, 0.72f, 0.08f), Palette.Mat(cloth, 0.22f));
                Mesh(rig.Chest, PrimitiveType.Cube, new Vector3(-0.16f, -0.55f, 0.02f), new Vector3(0.14f, 0.55f, 0.06f), Palette.Mat(clothDark, 0.2f));
                Mesh(rig.Chest, PrimitiveType.Cube, new Vector3(0.16f, -0.55f, 0.02f), new Vector3(0.14f, 0.55f, 0.06f), Palette.Mat(clothDark, 0.2f));
            }

            var neck = NewBone(rig.Chest, "Neck", new Vector3(0f, 0.16f, 0f));
            rig.Head = NewBone(neck, "Head", new Vector3(0f, 0.14f, 0f));
            rig.HeadObject = Mesh(rig.Head, PrimitiveType.Sphere, new Vector3(0f, 0.02f, 0f), Vector3.one * 0.22f, Palette.Mat(helmet ? clothDark : skin, helmet ? 0.45f : 0.2f, helmet ? 0.2f : 0f)).gameObject;
            if (helmet)
            {
                Mesh(rig.Head, PrimitiveType.Cube, new Vector3(0f, 0.02f, 0.08f), new Vector3(0.16f, 0.05f, 0.02f), Palette.Mat(style == 0 ? accent : new Color(0.05f, 0.08f, 0.1f), 0.7f, 0.4f));
            }
            else
            {
                Mesh(rig.Head, PrimitiveType.Sphere, new Vector3(0f, 0.06f, -0.02f), new Vector3(0.24f, 0.16f, 0.22f), Palette.Mat(clothDark, 0.2f));
                Mesh(rig.Head, PrimitiveType.Sphere, new Vector3(-0.05f, 0.03f, 0.09f), Vector3.one * 0.035f, Palette.Mat(new Color(0.1f, 0.1f, 0.12f), 0.6f));
                Mesh(rig.Head, PrimitiveType.Sphere, new Vector3(0.05f, 0.03f, 0.09f), Vector3.one * 0.035f, Palette.Mat(new Color(0.1f, 0.1f, 0.12f), 0.6f));
            }

            BuildArm(rig, true, cloth, skin, accent);
            BuildArm(rig, false, cloth, skin, accent);
            BuildLeg(rig, true, pants, boot);
            BuildLeg(rig, false, pants, boot);

            if (rifle) rig.Gun = BuildRifle(rig.Chest);
            else rig.Gun = BuildDagger(rig.HandR, accent);

            return rig;
        }

        static void BuildArm(BodyRig rig, bool left, Color cloth, Color skin, Color accent)
        {
            float s = left ? -1f : 1f;
            var shoulder = NewBone(rig.Chest, left ? "Shoulder.L" : "Shoulder.R", new Vector3(0.22f * s, 0.08f, 0f));
            var upper = NewBone(shoulder, left ? "ArmU.L" : "ArmU.R", Vector3.zero);
            Mesh(upper, PrimitiveType.Capsule, new Vector3(0f, -0.14f, 0f), new Vector3(0.09f, 0.14f, 0.09f), Palette.Mat(cloth, 0.3f));
            var lower = NewBone(upper, left ? "ArmL.L" : "ArmL.R", new Vector3(0f, -0.28f, 0f));
            Mesh(lower, PrimitiveType.Capsule, new Vector3(0f, -0.12f, 0f), new Vector3(0.075f, 0.12f, 0.075f), Palette.Mat(cloth * 0.9f, 0.3f));
            var hand = NewBone(lower, left ? "Hand.L" : "Hand.R", new Vector3(0f, -0.24f, 0f));
            Mesh(hand, PrimitiveType.Cube, new Vector3(0f, -0.04f, 0.02f), new Vector3(0.07f, 0.08f, 0.05f), Palette.Mat(skin, 0.25f));
            if (left) { rig.ArmUL = upper; rig.ArmLL = lower; rig.HandL = hand; }
            else { rig.ArmUR = upper; rig.ArmLR = lower; rig.HandR = hand; }
        }

        static void BuildLeg(BodyRig rig, bool left, Color pants, Color boot)
        {
            float s = left ? -1f : 1f;
            var upper = NewBone(rig.Hips, left ? "LegU.L" : "LegU.R", new Vector3(0.1f * s, -0.06f, 0f));
            Mesh(upper, PrimitiveType.Capsule, new Vector3(0f, -0.2f, 0f), new Vector3(0.12f, 0.2f, 0.12f), Palette.Mat(pants, 0.22f));
            var lower = NewBone(upper, left ? "LegL.L" : "LegL.R", new Vector3(0f, -0.4f, 0f));
            Mesh(lower, PrimitiveType.Capsule, new Vector3(0f, -0.18f, 0f), new Vector3(0.09f, 0.18f, 0.09f), Palette.Mat(pants * 0.85f, 0.2f));
            var foot = NewBone(lower, left ? "Foot.L" : "Foot.R", new Vector3(0f, -0.38f, 0.04f));
            Mesh(foot, PrimitiveType.Cube, new Vector3(0f, -0.04f, 0.05f), new Vector3(0.1f, 0.07f, 0.2f), Palette.Mat(boot, 0.35f, 0.1f));
            if (left) { rig.LegUL = upper; rig.LegLL = lower; rig.FootL = foot; }
            else { rig.LegUR = upper; rig.LegLR = lower; rig.FootR = foot; }
        }

        static Transform BuildRifle(Transform chest)
        {
            var gun = NewBone(chest, "Rifle", new Vector3(0.06f, -0.02f, 0.22f));
            var steel = Palette.Mat(new Color(0.18f, 0.19f, 0.2f), 0.65f, 0.75f);
            var dark = Palette.Mat(new Color(0.08f, 0.08f, 0.09f), 0.4f, 0.3f);
            var wood = Palette.Mat(new Color(0.28f, 0.18f, 0.1f), 0.35f, 0f);
            Mesh(gun, PrimitiveType.Cube, new Vector3(0f, 0f, 0.12f), new Vector3(0.05f, 0.07f, 0.38f), dark);
            Mesh(gun, PrimitiveType.Cylinder, new Vector3(0f, 0.015f, 0.42f), new Vector3(0.018f, 0.16f, 0.018f), steel, new Vector3(90f, 0f, 0f));
            Mesh(gun, PrimitiveType.Cube, new Vector3(0f, -0.07f, -0.02f), new Vector3(0.04f, 0.1f, 0.05f), dark);
            Mesh(gun, PrimitiveType.Cube, new Vector3(0f, -0.02f, -0.12f), new Vector3(0.04f, 0.06f, 0.16f), wood);
            Mesh(gun, PrimitiveType.Cube, new Vector3(0f, 0.05f, 0.08f), new Vector3(0.02f, 0.03f, 0.08f), steel);
            return gun;
        }

        static Transform BuildDagger(Transform hand, Color accent)
        {
            var knife = NewBone(hand, "Dagger", new Vector3(0f, -0.08f, 0.06f));
            Mesh(knife, PrimitiveType.Cube, new Vector3(0f, 0f, 0f), new Vector3(0.02f, 0.08f, 0.025f), Palette.Mat(new Color(0.15f, 0.1f, 0.08f), 0.3f));
            Mesh(knife, PrimitiveType.Cube, new Vector3(0f, -0.16f, 0.01f), new Vector3(0.012f, 0.22f, 0.004f), Palette.Mat(new Color(0.75f, 0.78f, 0.82f), 0.8f, 0.85f));
            Mesh(knife, PrimitiveType.Cube, new Vector3(0f, -0.05f, 0f), new Vector3(0.05f, 0.015f, 0.02f), Palette.Mat(accent, 0.5f, 0.4f));
            return knife;
        }

        static Transform NewBone(Transform parent, string name, Vector3 localPos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = Quaternion.identity;
            go.layer = Rules.LayerPawn;
            return go.transform;
        }

        static Transform Mesh(Transform parent, PrimitiveType type, Vector3 localPos, Vector3 scale, Material mat, Vector3 euler = default)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = type.ToString();
            var col = go.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            go.transform.localRotation = Quaternion.Euler(euler);
            go.layer = Rules.LayerPawn;
            var renderer = go.GetComponent<Renderer>();
            renderer.sharedMaterial = mat;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            renderer.receiveShadows = true;
            return go.transform;
        }
    }

    public static class BodyMotion
    {
        public static void Tick(BodyRig rig, float speed, float dt)
        {
            if (rig == null) return;
            rig.Phase += speed * dt * 7.5f;
            rig.Shoot = Mathf.MoveTowards(rig.Shoot, 0f, dt * 3.2f);
            rig.Slash = Mathf.MoveTowards(rig.Slash, 0f, dt * 2.6f);
            rig.Reload = Mathf.MoveTowards(rig.Reload, 0f, dt * 0.8f);
            if (!rig.Planting && rig.Death <= 0f)
                rig.Death = 0f;

            float swing = Mathf.Sin(rig.Phase);
            float lift = Mathf.Clamp01(speed / 4.2f);
            float recoil = rig.Shoot * 22f;
            float stab = Mathf.Sin(Mathf.Clamp01(rig.Slash) * Mathf.PI);

            if (rig.Death > 0f)
            {
                rig.Death = Mathf.MoveTowards(rig.Death, 1f, dt * 1.8f);
                rig.Visual.localRotation = Quaternion.Euler(rig.Death * 82f, rig.Death * 18f, rig.Death * -12f);
                rig.Visual.localPosition = new Vector3(0f, -0.55f * rig.Death, 0.35f * rig.Death);
                return;
            }

            float crouch = rig.Planting ? 0.38f : 0f;
            float bob = Mathf.Abs(swing) * 0.025f * lift;
            rig.Visual.localPosition = new Vector3(0f, bob - crouch, rig.Planting ? 0.12f : 0f);
            rig.Visual.localRotation = Quaternion.Euler(rig.Planting ? 22f : 0f, 0f, swing * 2.2f * lift);

            PoseLeg(rig.LegUL, rig.LegLL, rig.FootL, swing * 30f * lift);
            PoseLeg(rig.LegUR, rig.LegLR, rig.FootR, -swing * 30f * lift);

            float breathe = Mathf.Sin(Time.time * 1.6f) * 1.4f;
            rig.Spine.localRotation = Quaternion.Euler(breathe + (rig.Planting ? 12f : 0f), 0f, 0f);
            float aim = Mathf.Clamp(rig.AimPitch, -50f, 55f) * 0.35f;

            if (rig.Rifle && rig.Gun != null)
            {
                float reload = rig.Reload;
                rig.ArmUR.localRotation = Quaternion.Euler(74f + recoil - reload * 40f + aim, 16f, -18f);
                rig.ArmLR.localRotation = Quaternion.Euler(8f + reload * 30f, 0f, 0f);
                rig.ArmUL.localRotation = Quaternion.Euler(76f + recoil * 0.4f + aim, -24f + reload * 20f, 20f);
                rig.ArmLL.localRotation = Quaternion.Euler(6f, 0f, 0f);
                rig.Gun.localRotation = Quaternion.Euler(aim + recoil * 0.3f, 0f, 0f);
                float sway = swing * 0.8f * lift;
                rig.Gun.localPosition = new Vector3(0.06f, -0.02f + sway * 0.005f, 0.22f);
            }
            else
            {
                rig.ArmUR.localRotation = Quaternion.Euler(18f - stab * 78f, -8f, 10f);
                rig.ArmLR.localRotation = Quaternion.Euler(stab * 25f, 0f, 0f);
                rig.ArmUL.localRotation = Quaternion.Euler(swing * 16f * lift, 0f, -10f);
                rig.ArmLL.localRotation = Quaternion.Euler(Mathf.Max(0f, -swing) * 20f * lift, 0f, 0f);
                if (rig.Gun != null)
                    rig.Gun.localRotation = Quaternion.Euler(-70f * stab, 0f, 0f);
            }

            if (rig.Head != null)
                rig.Head.localRotation = Quaternion.Euler(aim * 0.25f, 0f, 0f);
        }

        static void PoseLeg(Transform upper, Transform lower, Transform foot, float hip)
        {
            if (upper == null) return;
            upper.localRotation = Quaternion.Euler(hip, 0f, 0f);
            float knee = Mathf.Clamp(-hip, 0f, 40f) * 1.35f;
            lower.localRotation = Quaternion.Euler(knee, 0f, 0f);
            if (foot != null) foot.localRotation = Quaternion.Euler(-knee * 0.35f, 0f, 0f);
        }
    }
}

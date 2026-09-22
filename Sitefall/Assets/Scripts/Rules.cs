using UnityEngine;

namespace Sitefall
{
    public static class Rules
    {
        public const float Health = 150f;
        public const float HeadDamage = 100f;
        public const float BodyDamage = 50f;
        public const float LegDamage = 25f;
        public const float BackstabDamage = 150f;
        public const float SlashDamage = 60f;
        public const float MeleeRange = 1.4f;
        public const float BackAngle = 120f;
        public const int Magazine = 30;
        public const float FireInterval = 0.16f;
        public const float ReloadTime = 2f;
        public const float MeleeCooldown = 0.7f;
        public const float HuntTime = 240f;
        public const float ElimTime = 90f;
        public const float RoundTime = 100f;
        public const float PlantTime = 4f;
        public const float DefuseTime = 7f;
        public const float FuseTime = 45f;
        public const int RoundsToWin = 5;
        public const ushort Port = 7777;

        public const int LayerHit = 8;
        public const int LayerPawn = 9;
        public static int WeaponMask => (1 << 0) | (1 << LayerHit);
    }

    public static class Session
    {
        public static int Mode;
        public static bool HostIsKiller = true;
        public static string JoinAddress = "127.0.0.1";
        public static float Sensitivity = 2.2f;
        public static float Volume = 0.8f;

        public static void Load()
        {
            Sensitivity = PlayerPrefs.GetFloat("sitefall.sens", 2.2f);
            Volume = PlayerPrefs.GetFloat("sitefall.vol", 0.8f);
            AudioListener.volume = Volume;
        }

        public static void Save()
        {
            PlayerPrefs.SetFloat("sitefall.sens", Sensitivity);
            PlayerPrefs.SetFloat("sitefall.vol", Volume);
            PlayerPrefs.Save();
            AudioListener.volume = Volume;
        }
    }

    public static class View
    {
        public static bool Claimed;
        public static Transform Eye;
        public static float Pitch;
        public static float Bob;
    }
}

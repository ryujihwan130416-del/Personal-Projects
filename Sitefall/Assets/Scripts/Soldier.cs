using Unity.Netcode;
using UnityEngine;

namespace Sitefall
{
    public enum HitPart { Body, Head, Leg }

    public class HitVolume : MonoBehaviour
    {
        public Soldier Owner;
        public HitPart Part;
    }

    public class Soldier : NetworkBehaviour
    {
        public NetworkVariable<int> TeamId = new NetworkVariable<int>(0);
        public NetworkVariable<int> Kind = new NetworkVariable<int>(1);
        public NetworkVariable<int> Number = new NetworkVariable<int>(1);
        public NetworkVariable<bool> Bot = new NetworkVariable<bool>(true);
        public NetworkVariable<bool> HasRifle = new NetworkVariable<bool>(true);
        public NetworkVariable<float> Health = new NetworkVariable<float>(Rules.Health);
        public NetworkVariable<bool> Alive = new NetworkVariable<bool>(true);
        public NetworkVariable<int> Ammo = new NetworkVariable<int>(Rules.Magazine);
        public NetworkVariable<bool> Reloading = new NetworkVariable<bool>(false);
        public NetworkVariable<Vector3> SyncPos = new NetworkVariable<Vector3>(
            Vector3.zero, NetworkVariableReadPermission.Everyone, NetworkVariableWritePermission.Owner);
        public NetworkVariable<float> SyncYaw = new NetworkVariable<float>(
            0f, NetworkVariableReadPermission.Everyone, NetworkVariableWritePermission.Owner);
        public NetworkVariable<float> SyncPitch = new NetworkVariable<float>(
            0f, NetworkVariableReadPermission.Everyone, NetworkVariableWritePermission.Owner);

        public int InitialTeam;
        public int InitialKind;
        public int InitialNumber;
        public bool InitialBot = true;

        CharacterController body;
        BodyRig rig;
        float yaw;
        float pitch;
        float vertical;
        float nextFire;
        float nextMelee;
        float reloadLeft;
        float syncTimer;
        float shotPulse;
        float slashPulse;
        Vector3 shown;
        bool shownReady;
        public bool ServerUse;

        public Vector3 EyeWorld => transform.position + Vector3.up * 1.62f;

        public void ServerPrepare(int team, int kind, int number, bool bot)
        {
            InitialTeam = team;
            InitialKind = kind;
            InitialNumber = number;
            InitialBot = bot;
            TeamId.Value = team;
            Kind.Value = kind;
            Number.Value = number;
            Bot.Value = bot;
            HasRifle.Value = kind != 1;
            Ammo.Value = HasRifle.Value ? Rules.Magazine : 0;
            Health.Value = Rules.Health;
            Alive.Value = true;
            Reloading.Value = false;
            SyncPos.Value = transform.position;
            SyncYaw.Value = transform.eulerAngles.y;
        }

        void Awake()
        {
            body = GetComponent<CharacterController>();
            body.height = 1.8f;
            body.radius = 0.32f;
            body.center = new Vector3(0f, 0.9f, 0f);
            body.stepOffset = 0.3f;
            body.slopeLimit = 50f;
            gameObject.layer = Rules.LayerPawn;
        }

        public override void OnNetworkSpawn()
        {
            shown = transform.position;
            shownReady = true;
            body.enabled = IsOwner;
            yaw = transform.eulerAngles.y;
            BuildHitboxes();
            rig = BodyBuilder.Create(transform, Kind.Value, HasRifle.Value, Number.Value);
            if (IsOwner && !Bot.Value)
            {
                rig.SetFirstPerson(true);
                View.Claimed = true;
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
            Alive.OnValueChanged += (_, now) =>
            {
                if (!now) BeginDeath();
            };
        }

        public override void OnNetworkDespawn()
        {
            if (IsOwner && !Bot.Value)
            {
                View.Claimed = false;
                View.Eye = null;
            }
        }

        void BuildHitboxes()
        {
            Volume("Head", PrimitiveType.Sphere, new Vector3(0f, 1.64f, 0f), new Vector3(0.34f, 0.34f, 0.34f), HitPart.Head);
            Volume("Torso", PrimitiveType.Capsule, new Vector3(0f, 1.15f, 0f), new Vector3(0.5f, 0.42f, 0.34f), HitPart.Body);
            Volume("Legs", PrimitiveType.Capsule, new Vector3(0f, 0.42f, 0f), new Vector3(0.4f, 0.4f, 0.3f), HitPart.Leg);
        }

        void Volume(string name, PrimitiveType type, Vector3 pos, Vector3 scale, HitPart part)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.layer = Rules.LayerHit;
            go.transform.SetParent(transform, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var renderer = go.GetComponent<Renderer>();
            if (renderer != null) renderer.enabled = false;
            var volume = go.AddComponent<HitVolume>();
            volume.Owner = this;
            volume.Part = part;
        }

        void Update()
        {
            if (!IsSpawned) return;
            if (IsOwner && !Bot.Value) HumanTick();
            else if (!IsOwner) RemoteTick();
            if (IsServer) ServerTick();
            Animate();
        }

        void HumanTick()
        {
            var match = Match.Instance;
            bool live = Alive.Value && match != null && match.Phase.Value == 1;
            if (live && Cursor.lockState == CursorLockMode.Locked)
            {
                yaw += Input.GetAxis("Mouse X") * Session.Sensitivity * 2.2f;
                pitch -= Input.GetAxis("Mouse Y") * Session.Sensitivity * 2.2f;
                pitch = Mathf.Clamp(pitch, -80f, 80f);
                transform.rotation = Quaternion.Euler(0f, yaw, 0f);

                float x = (Input.GetKey(KeyCode.D) ? 1f : 0f) - (Input.GetKey(KeyCode.A) ? 1f : 0f);
                float z = (Input.GetKey(KeyCode.W) ? 1f : 0f) - (Input.GetKey(KeyCode.S) ? 1f : 0f);
                var wish = transform.right * x + transform.forward * z;
                if (wish.sqrMagnitude > 1f) wish.Normalize();
                bool sprint = Input.GetKey(KeyCode.LeftShift);
                float speed = sprint ? 6.6f : 4.3f;
                if (body.isGrounded && vertical < 0f) vertical = -2f;
                if (Input.GetKeyDown(KeyCode.Space) && body.isGrounded) vertical = 6.2f;
                vertical += -24f * Time.deltaTime;
                body.Move(wish * speed * Time.deltaTime + Vector3.up * vertical * Time.deltaTime);
                View.Bob = wish.magnitude * (sprint ? 1f : 0.6f);

                bool aim = Input.GetMouseButton(1);
                if (HasRifle.Value && Input.GetMouseButton(0))
                {
                    Vector3 dir = AimDirection(aim ? 0.15f : 1.3f);
                    TryFire(EyeWorld, dir);
                }
                if (Input.GetKeyDown(KeyCode.R)) ReloadServerRpc();
                if (Input.GetKeyDown(KeyCode.F)) TryMelee();
                bool use = Input.GetKey(KeyCode.E);
                if (use != ServerUse) SetUseServerRpc(use);
                ServerUse = use;
            }
            else if (body.isGrounded)
            {
                vertical = -2f;
            }

            if (!Alive.Value) return;
            syncTimer -= Time.deltaTime;
            if (syncTimer <= 0f)
            {
                syncTimer = 0.05f;
                SyncPos.Value = transform.position;
                SyncYaw.Value = yaw;
                SyncPitch.Value = pitch;
            }
            View.Claimed = true;
            View.Pitch = pitch;
        }

        void RemoteTick()
        {
            if (!shownReady) shown = SyncPos.Value;
            float t = 1f - Mathf.Exp(-14f * Time.deltaTime);
            shown = Vector3.Lerp(shown, SyncPos.Value, t);
            transform.position = shown;
            float y = Mathf.LerpAngle(transform.eulerAngles.y, SyncYaw.Value, t);
            transform.rotation = Quaternion.Euler(0f, y, 0f);
            pitch = Mathf.Lerp(pitch, SyncPitch.Value, t);
        }

        void ServerTick()
        {
            if (!Reloading.Value) return;
            reloadLeft -= Time.deltaTime;
            if (reloadLeft <= 0f)
            {
                Reloading.Value = false;
                Ammo.Value = Rules.Magazine;
            }
        }

        void Animate()
        {
            if (rig == null) return;
            float speed = 0f;
            if (Alive.Value)
            {
                var delta = transform.position - shown;
                if (IsOwner) speed = new Vector3(body.velocity.x, 0f, body.velocity.z).magnitude;
                else speed = new Vector3(delta.x, 0f, delta.z).magnitude / Mathf.Max(Time.deltaTime, 0.001f);
            }
            if (IsOwner) shown = transform.position;
            rig.AimPitch = IsOwner && !Bot.Value ? pitch : SyncPitch.Value;
            rig.Shoot = Mathf.Max(rig.Shoot, shotPulse);
            rig.Slash = Mathf.Max(rig.Slash, slashPulse);
            shotPulse = Mathf.MoveTowards(shotPulse, 0f, Time.deltaTime * 3f);
            slashPulse = Mathf.MoveTowards(slashPulse, 0f, Time.deltaTime * 2.4f);
            rig.Reload = Reloading.Value ? 1f : rig.Reload;
            var match = Match.Instance;
            rig.Planting = match != null && Alive.Value && match.Carrier.Value == NetworkObjectId &&
                           (match.BombState.Value == 1 || match.BombState.Value == 3);
            if (!Alive.Value && rig.Death <= 0f) rig.Death = 0.01f;
            var eye = transform.Find("Eye");
            if (eye == null)
            {
                var go = new GameObject("Eye");
                go.transform.SetParent(transform, false);
                go.transform.localPosition = new Vector3(0f, 1.62f, 0.08f);
                eye = go.transform;
            }
            if (IsOwner && !Bot.Value)
            {
                float bob = Mathf.Sin(Time.time * 9f) * 0.015f * View.Bob;
                eye.localPosition = new Vector3(0f, 1.62f + bob, 0.1f);
                View.Eye = eye;
            }
            BodyMotion.Tick(rig, speed, Time.deltaTime);
        }

        void BeginDeath()
        {
            if (body != null) body.enabled = false;
            foreach (var volume in GetComponentsInChildren<HitVolume>())
                volume.gameObject.SetActive(false);
            if (IsOwner && !Bot.Value)
            {
                View.Claimed = false;
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        Vector3 AimDirection(float degrees)
        {
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            if (degrees > 0f)
            {
                var offset = Random.insideUnitSphere * degrees;
                rotation *= Quaternion.Euler(offset.x, offset.y, 0f);
            }
            return rotation * Vector3.forward;
        }

        void TryFire(Vector3 origin, Vector3 direction)
        {
            if (!HasRifle.Value || Ammo.Value <= 0 || Reloading.Value) return;
            if (Time.time < nextFire) return;
            shotPulse = 1f;
            if (IsServer) ServerFire(origin, direction);
            else
            {
                nextFire = Time.time + Rules.FireInterval;
                FireServerRpc(origin, direction);
            }
        }

        void TryMelee()
        {
            if (Kind.Value == 0) return;
            if (Time.time < nextMelee) return;
            slashPulse = 1f;
            if (IsServer) ServerMelee();
            else
            {
                nextMelee = Time.time + Rules.MeleeCooldown;
                MeleeServerRpc();
            }
        }

        public void BotFire(Vector3 origin, Vector3 direction)
        {
            if (!IsServer) return;
            ServerFire(origin, direction);
        }

        public void BotMelee()
        {
            if (!IsServer || Kind.Value == 0) return;
            ServerMelee();
        }

        [ServerRpc]
        void FireServerRpc(Vector3 origin, Vector3 direction) => ServerFire(origin, direction);

        [ServerRpc]
        void MeleeServerRpc() => ServerMelee();

        [ServerRpc]
        void ReloadServerRpc()
        {
            if (!HasRifle.Value || Ammo.Value >= Rules.Magazine || Reloading.Value || !Alive.Value) return;
            Reloading.Value = true;
            reloadLeft = Rules.ReloadTime;
        }

        [ServerRpc]
        void SetUseServerRpc(bool held) => ServerUse = held;

        void ServerFire(Vector3 origin, Vector3 direction)
        {
            if (!Alive.Value || !HasRifle.Value || Reloading.Value || Ammo.Value <= 0) return;
            if (Time.time < nextFire) return;
            if ((origin - EyeWorld).sqrMagnitude > 6f) origin = EyeWorld;
            if (direction.sqrMagnitude < 0.01f) return;
            direction.Normalize();
            nextFire = Time.time + Rules.FireInterval;
            Ammo.Value = Mathf.Max(0, Ammo.Value - 1);
            Vector3 end = origin + direction * 90f;
            bool confirm = false;
            var hits = Physics.RaycastAll(origin, direction, 90f, Rules.WeaponMask, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (var hit in hits)
            {
                var volume = hit.collider.GetComponent<HitVolume>();
                if (volume == null)
                {
                    end = hit.point;
                    break;
                }
                var victim = volume.Owner;
                if (victim == null || victim == this || !victim.Alive.Value) continue;
                if (victim.TeamId.Value == TeamId.Value) continue;
                float damage = volume.Part == HitPart.Head ? Rules.HeadDamage :
                    volume.Part == HitPart.Leg ? Rules.LegDamage : Rules.BodyDamage;
                victim.ApplyDamage(damage, this, false);
                end = hit.point;
                confirm = true;
                break;
            }
            ShotClientRpc(origin, end);
            if (confirm && !Bot.Value) ConfirmClientRpc();
        }

        void ServerMelee()
        {
            if (!Alive.Value || Kind.Value == 0) return;
            if (Time.time < nextMelee) return;
            nextMelee = Time.time + Rules.MeleeCooldown;
            Soldier best = null;
            float bestDistance = Rules.MeleeRange;
            foreach (var other in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (other == this || !other.Alive.Value || other.TeamId.Value == TeamId.Value) continue;
                float distance = Vector3.Distance(transform.position, other.transform.position);
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = other;
                }
            }
            MeleeClientRpc();
            if (best == null) return;
            Vector3 toAttacker = transform.position - best.transform.position;
            toAttacker.y = 0f;
            Vector3 forward = best.transform.forward;
            forward.y = 0f;
            float angle = Vector3.Angle(forward, toAttacker);
            bool back = angle >= Rules.BackAngle;
            best.ApplyDamage(back ? Rules.BackstabDamage : Rules.SlashDamage, this, back);
        }

        public void ApplyDamage(float amount, Soldier from, bool backstab)
        {
            if (!IsServer || !Alive.Value) return;
            Health.Value = Mathf.Max(0f, Health.Value - amount);
            if (Health.Value > 0f) return;
            Alive.Value = false;
            if (body != null) body.enabled = false;
            if (Match.Instance != null) Match.Instance.ReportDeath(this, from, backstab);
        }

        [ClientRpc]
        void ShotClientRpc(Vector3 from, Vector3 to)
        {
            shotPulse = 1f;
            Fx.Tracer(from, to);
            Fx.Play(from, Fx.Shot, 0.7f);
        }

        [ClientRpc]
        void MeleeClientRpc()
        {
            slashPulse = 1f;
            Fx.Play(transform.position, Fx.Stab, 0.8f);
        }

        [ClientRpc]
        void ConfirmClientRpc()
        {
            if (IsOwner) Hud.MarkHit();
        }

        public string Label()
        {
            switch (Kind.Value)
            {
                case 0: return "킬러";
                case 1: return "시민 " + Number.Value;
                case 2: return "공격 " + Number.Value;
                default: return "수비 " + Number.Value;
            }
        }
    }
}

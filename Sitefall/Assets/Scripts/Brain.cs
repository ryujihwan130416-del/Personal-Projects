using UnityEngine;

namespace Sitefall
{
    public class Brain : MonoBehaviour
    {
        Soldier self;
        float think;
        float stuck;
        Vector3 lastPos;
        Vector3 goal;
        Soldier focus;
        float aimWait;
        float flankClock;

        void Awake() => self = GetComponent<Soldier>();

        void Update()
        {
            if (self == null || !self.IsSpawned || !self.IsServer || !self.Bot.Value || !self.Alive.Value) return;
            var match = Match.Instance;
            if (match == null || match.Phase.Value != 1) return;

            think -= Time.deltaTime;
            if (think <= 0f)
            {
                think = 0.22f;
                Choose();
            }
            Move();
            Act();
        }

        void Choose()
        {
            focus = null;
            float best = 55f;
            foreach (var other in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (other == self || !other.Alive.Value || other.TeamId.Value == self.TeamId.Value) continue;
                if (!See(other)) continue;
                float distance = Vector3.Distance(transform.position, other.transform.position);
                if (distance < best)
                {
                    best = distance;
                    focus = other;
                }
            }

            if (self.Kind.Value == 1)
            {
                var killer = Killer();
                if (killer != null)
                {
                    Vector3 side = Vector3.Cross(Vector3.up, killer.transform.forward);
                    if (side.sqrMagnitude < 0.01f) side = Vector3.right;
                    side.Normalize();
                    float sign = (self.Number.Value % 2 == 0) ? 1f : -1f;
                    float distance = Vector3.Distance(transform.position, killer.transform.position);
                    if (distance > 7f) goal = killer.transform.position + side * sign * 3.2f - killer.transform.forward * 1f;
                    else goal = killer.transform.position - killer.transform.forward * 1.15f + side * sign * 0.6f;
                    return;
                }
            }

            if (self.Kind.Value == 2 && matchBomb() && Match.Instance.Carrier.Value == self.NetworkObjectId && focus == null)
            {
                goal = CloserSite();
                return;
            }
            if (self.Kind.Value == 3 && matchBomb() && Match.Instance.BombState.Value == 2)
            {
                goal = Match.Instance.BombState.Value == 2 ? PlantedPoint() : goal;
                return;
            }
            if (focus != null)
            {
                goal = focus.transform.position;
                return;
            }
            if ((transform.position - goal).sqrMagnitude < 1.2f || goal == Vector3.zero)
                goal = Arena.Waypoints[Random.Range(0, Arena.Waypoints.Length)];
        }

        static bool matchBomb() => Match.Instance != null && Match.Instance.Mode.Value == 2;

        Vector3 CloserSite()
        {
            float a = (transform.position - Arena.SiteA).sqrMagnitude;
            float b = (transform.position - Arena.SiteB).sqrMagnitude;
            return a < b ? Arena.SiteA : Arena.SiteB;
        }

        Vector3 PlantedPoint() => Match.Instance.BombSite.Value == 0 ? Arena.SiteA : Arena.SiteB;

        Soldier Killer()
        {
            foreach (var other in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
                if (other.Alive.Value && other.Kind.Value == 0) return other;
            return null;
        }

        bool See(Soldier other)
        {
            Vector3 from = self.EyeWorld;
            Vector3 to = other.transform.position + Vector3.up * 1.35f;
            Vector3 dir = to - from;
            float distance = dir.magnitude;
            if (distance < 0.2f) return true;
            var hits = Physics.RaycastAll(from, dir.normalized, distance, Rules.WeaponMask, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (var hit in hits)
            {
                var volume = hit.collider.GetComponent<HitVolume>();
                if (volume == null) return false;
                if (volume.Owner == self) continue;
                if (volume.Owner == other) return true;
                if (volume.Owner != null && volume.Owner.TeamId.Value == self.TeamId.Value) continue;
                return false;
            }
            return true;
        }

        void Move()
        {
            var cc = GetComponent<CharacterController>();
            if (cc == null || !cc.enabled) return;
            Vector3 flat = goal - transform.position;
            flat.y = 0f;
            if (focus != null && self.HasRifle.Value && Vector3.Distance(transform.position, focus.transform.position) < 28f)
            {
                Vector3 look = focus.transform.position - transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(look), 280f * Time.deltaTime);
            }
            else if (flat.sqrMagnitude > 0.16f)
            {
                transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(flat), 320f * Time.deltaTime);
            }

            Vector3 delta = transform.position - lastPos;
            delta.y = 0f;
            if (delta.magnitude < 0.02f) stuck += Time.deltaTime;
            else stuck = 0f;
            lastPos = transform.position;
            if (stuck > 1.1f)
            {
                stuck = 0f;
                goal = Arena.Waypoints[Random.Range(0, Arena.Waypoints.Length)];
            }

            float speed = self.Kind.Value == 1 ? 5.4f : 4.6f;
            if (focus != null && self.HasRifle.Value && Vector3.Distance(transform.position, focus.transform.position) < 18f)
                speed = 2.2f;
            Vector3 push = Vector3.zero;
            foreach (var other in FindObjectsByType<Soldier>(FindObjectsSortMode.None))
            {
                if (other == self || !other.Alive.Value) continue;
                Vector3 away = transform.position - other.transform.position;
                away.y = 0f;
                if (away.magnitude < 1.15f && away.magnitude > 0.01f)
                    push += away.normalized * 1.4f;
            }
            Vector3 motion = transform.forward * (flat.magnitude > 0.4f ? speed : 0f) + push;
            if (!cc.isGrounded) motion += Vector3.down * 16f;
            cc.Move(motion * Time.deltaTime);
            self.SyncPos.Value = transform.position;
            self.SyncYaw.Value = transform.eulerAngles.y;
            if (focus != null)
            {
                Vector3 aim = (focus.transform.position + Vector3.up * 1.45f) - self.EyeWorld;
                self.SyncPitch.Value = Mathf.Lerp(self.SyncPitch.Value, -Mathf.Atan2(aim.y, new Vector2(aim.x, aim.z).magnitude) * Mathf.Rad2Deg, 0.2f);
            }
        }

        void Act()
        {
            self.ServerUse = false;
            if (self.Kind.Value == 1)
            {
                var killer = focus != null && focus.Kind.Value == 0 ? focus : Killer();
                if (killer == null) return;
                float distance = Vector3.Distance(transform.position, killer.transform.position);
                Vector3 toMe = transform.position - killer.transform.position;
                toMe.y = 0f;
                float angle = Vector3.Angle(killer.transform.forward, toMe);
                if (distance <= Rules.MeleeRange && angle >= Rules.BackAngle)
                {
                    self.BotMelee();
                    flankClock = 0f;
                }
                else if (distance <= 1.25f)
                {
                    flankClock += Time.deltaTime;
                    if (flankClock > 2.4f) self.BotMelee();
                }
                else flankClock = 0f;
                return;
            }

            if (self.HasRifle.Value && focus != null && See(focus))
            {
                aimWait += Time.deltaTime;
                if (aimWait > 0.28f)
                {
                    Vector3 aim = focus.transform.position + Vector3.up * (Random.value < 0.25f ? 1.62f : 1.2f);
                    aim += Random.insideUnitSphere * 0.18f;
                    Vector3 dir = (aim - self.EyeWorld).normalized;
                    self.BotFire(self.EyeWorld, dir);
                }
            }
            else aimWait = 0f;

            if (!matchBomb() || Match.Instance == null) return;
            var match = Match.Instance;
            if (self.Kind.Value == 2 && match.Carrier.Value == self.NetworkObjectId && focus == null)
            {
                if (Arena.SiteAt(transform.position) >= 0) self.ServerUse = true;
            }
            if (self.Kind.Value == 3 && match.BombState.Value == 2)
            {
                int site = Arena.SiteAt(transform.position);
                if (site == match.BombSite.Value) self.ServerUse = true;
            }
        }
    }
}

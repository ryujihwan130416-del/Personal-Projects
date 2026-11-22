/** The single Pingo admin account (rules grant it read/write across dmly/app). */
export const ADMIN_UID = '2agMzRLd2yeI4OorKuv3opTwdzD3'
export const isAdminUid = (uid?: string | null) => !!uid && uid === ADMIN_UID

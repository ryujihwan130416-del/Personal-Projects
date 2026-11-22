import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, fsCol } from '../firebase/app'

export async function follow(me: string, other: string) {
  await setDoc(doc(db, ...fsCol('users', me, 'following', other)), { createdAt: serverTimestamp() })
  await setDoc(doc(db, ...fsCol('users', other, 'followers', me)), { createdAt: serverTimestamp() })
}
export async function unfollow(me: string, other: string) {
  await deleteDoc(doc(db, ...fsCol('users', me, 'following', other)))
  await deleteDoc(doc(db, ...fsCol('users', other, 'followers', me)))
}

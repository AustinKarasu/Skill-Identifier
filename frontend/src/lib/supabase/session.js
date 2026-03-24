import { getSupabaseClient } from './client'

export function startSupabaseSessionRefresh() {
  let subscription = null
  let visibilityHandler = null

  try {
    const supabase = getSupabaseClient()

    supabase.auth.getSession().catch(() => {})

    const authSubscription = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getSession().catch(() => {})
    })

    subscription = authSubscription.data.subscription

    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', visibilityHandler)
  } catch {
    return () => {}
  }

  return () => {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
    }

    subscription?.unsubscribe()
  }
}

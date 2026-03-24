import { useEffect, useId, useRef, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

const loadRecaptcha = () =>
  new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve(window.grecaptcha)
      return
    }

    const existing = document.querySelector('script[data-recaptcha="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.grecaptcha))
      existing.addEventListener('error', () => reject(new Error('Captcha failed to load')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.recaptcha = 'true'
    script.onload = () => resolve(window.grecaptcha)
    script.onerror = () => reject(new Error('Captcha failed to load'))
    document.body.appendChild(script)
  })

export default function RecaptchaCheckbox({ onVerify, onExpire, theme = 'dark', resetKey = 0 }) {
  const id = useId()
  const containerRef = useRef(null)
  const widgetRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const render = async () => {
      if (!SITE_KEY) {
        setError('Captcha site key is missing.')
        return
      }
      try {
        const grecaptcha = await loadRecaptcha()
        if (!mounted || !containerRef.current) return
        if (widgetRef.current !== null) return
        widgetRef.current = grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token) => onVerify && onVerify(token),
          'expired-callback': () => onExpire && onExpire(),
        })
      } catch (err) {
        if (!mounted) return
        setError(err.message || 'Captcha failed to load')
      }
    }

    render()
    return () => {
      mounted = false
    }
  }, [onVerify, onExpire, theme])

  useEffect(() => {
    if (!window.grecaptcha || widgetRef.current === null) return
    window.grecaptcha.reset(widgetRef.current)
  }, [resetKey])

  return (
    <div className="space-y-2">
      <div id={`recaptcha-${id}`} ref={containerRef} />
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}

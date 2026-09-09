import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  value: string
  size?: number
}

/** Renderitza un codi QR com a imatge (data URL) amb els colors de la marca. */
export function QRCode({ value, size = 200 }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#001048', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch((e) => console.error('QR error', e))
    return () => {
      active = false
    }
  }, [value, size])

  if (!dataUrl) {
    return <div className="rounded-2xl bg-white/10" style={{ width: size, height: size }} />
  }

  return (
    <img
      src={dataUrl}
      alt="QR"
      width={size}
      height={size}
      className="rounded-2xl bg-white p-2"
    />
  )
}

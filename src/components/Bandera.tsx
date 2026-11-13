/** Banderas chicas dibujadas (los emojis de bandera no se ven en todos lados). */
export function Bandera({ codigo }: { codigo: string }) {
  return (
    <svg className="bandera" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true">
      {codigo === 'ARS' ? (
        <>
          <rect width="24" height="16" fill="#74acdf" />
          <rect y="5.33" width="24" height="5.34" fill="#fff" />
          <circle cx="12" cy="8" r="1.9" fill="#f6b40e" />
        </>
      ) : codigo === 'BRL' ? (
        <>
          <rect width="24" height="16" fill="#009c3b" />
          <path d="M12 2 21.5 8 12 14 2.5 8z" fill="#ffdf00" />
          <circle cx="12" cy="8" r="3.4" fill="#002776" />
        </>
      ) : (
        <>
          <rect width="24" height="16" fill="#fff" />
          {[0, 2, 4, 6].map((i) => (
            <rect key={i} y={(i * 16) / 7} width="24" height={16 / 7} fill="#b22234" />
          ))}
          <rect width="10.5" height={(16 / 7) * 4} fill="#3c3b6e" />
          {[
            [2.2, 2], [5.2, 2], [8.2, 2], [3.7, 4.6], [6.7, 4.6], [2.2, 7.2], [5.2, 7.2], [8.2, 7.2],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.65" fill="#fff" />
          ))}
        </>
      )}
      <rect x="0.25" y="0.25" width="23.5" height="15.5" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="0.5" />
    </svg>
  )
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
            <defs><linearGradient id={`s${i}-${Math.round(fill * 100)}`}><stop offset={`${fill * 100}%`} stopColor="#f5b942" /><stop offset={`${fill * 100}%`} stopColor="#d9dce6" /></linearGradient></defs>
            <path fill={`url(#s${i}-${Math.round(fill * 100)})`} d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" />
          </svg>
        );
      })}
    </span>
  );
}

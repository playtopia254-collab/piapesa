interface CurrencyFormatterProps {
  amount: number
  className?: string
}

export function CurrencyFormatter({ amount, className = "" }: CurrencyFormatterProps) {
  const formatKES = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return <span className={className}>{formatKES(amount)}</span>
}

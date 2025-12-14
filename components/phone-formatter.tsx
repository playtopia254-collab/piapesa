interface PhoneFormatterProps {
  phone: string
  className?: string
}

export function PhoneFormatter({ phone, className = "" }: PhoneFormatterProps) {
  // Format Kenyan phone numbers for display
  const formatPhone = (phone: string) => {
    if (phone.startsWith("+254")) {
      return phone.replace("+254", "0")
    }
    return phone
  }

  return <span className={className}>{formatPhone(phone)}</span>
}

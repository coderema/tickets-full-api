export enum BookingStatus {
  PENDING    = 'pending',
  CONFIRMED  = 'confirmed',
  CANCELLED  = 'cancelled',
}

export enum PaymentGateway {
  STRIPE = 'stripe',
  CASH   = 'cash',
}

export enum PaymentStatus {
  PENDING   = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED    = 'failed',
  REFUNDED  = 'refunded',
}

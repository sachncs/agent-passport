import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const REQUEST_ID_HEADER = "x-request-id"

export function proxy(request: NextRequest) {
  const incomingId = request.headers.get(REQUEST_ID_HEADER)
  const requestId =
    incomingId && /^[A-Za-z0-9._-]{1,128}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
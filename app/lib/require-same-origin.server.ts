import { data } from "react-router"

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("Origin")

  if (origin !== null && origin !==new URL(request.url).origin) {
    throw data({ success: false, error: "Forbidden" }, { status: 403 })
  }
}

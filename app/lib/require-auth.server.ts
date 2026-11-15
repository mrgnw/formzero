import { redirect } from "react-router"
import { getAuth } from "~/lib/auth.server"

/**
 * Requires authentication for a route. Redirects to /login if not authenticated.
 * Returns the authenticated user.
 */
export async function requireAuth(request: Request, env: Env) {
  const auth = getAuth(env)
  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (!session?.user) {
    throw redirect("/login")
  }

  return session.user
}

import { auth } from '@/auth';
import { NavbarShell } from '@/components/navbar-shell';

/**
 * Site header for CJ Private Tutoring.
 *
 * Server component: it reads the session here so the role never has to be
 * fetched from the browser, and the header renders correct on first paint
 * rather than flashing a signed-out state. All interactivity lives in
 * NavbarShell, which receives only two plain serialisable props.
 */
export default async function Navbar() {
  const session = await auth();

  return (
    <NavbarShell
      isSignedIn={Boolean(session?.user)}
    />
  );
}

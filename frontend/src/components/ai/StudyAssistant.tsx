import { auth } from '@/auth';
import ChatWidget from './ChatWidget';

/**
 * Mounts the AI Study Assistant.
 *
 * Shown to everyone, signed in or not: a visitor weighing up a lesson can ask
 * a Maths question first, and on a phone the floating launcher is the only
 * affordance there is room for.
 *
 * Server component, so the session is read here and the browser is never asked
 * who the user is. The only thing it decides is the copy - whether the panel
 * mentions that the thread is not saved. Access and rate limiting are settled
 * by the API independently (CLAUDE.md section 25); this cannot grant anything.
 */
export default async function StudyAssistant() {
  const session = await auth();

  return <ChatWidget isSignedIn={Boolean(session?.user?.id)} />;
}

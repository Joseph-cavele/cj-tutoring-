import { auth } from '@/auth';
import ChatWidget from './ChatWidget';

/**
 * Gate for the AI Study Assistant.
 *
 * Server component: the session is read here so the widget never renders for
 * a signed-out visitor, and the browser is never asked who the user is.
 * The API enforces the same rule independently (CLAUDE.md section 25) - this
 * is only about not showing a launcher that would 401.
 */
export default async function StudyAssistant() {
  const session = await auth();

  if (!session?.user?.id) return null;

  return <ChatWidget />;
}

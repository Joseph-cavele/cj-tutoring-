// Importing from this barrel registers every schema with Mongoose, which is
// what makes .populate() work for refs the current route did not import.
export * from './types';

export { default as User, type IUser } from './User';
export { default as Student, type IStudent } from './Student';
export { default as Parent, type IParent } from './Parent';
export { default as Tutor, type ITutor } from './Tutor';

export { default as Grade, type IGrade } from './Grade';
export { default as Subject, type ISubject } from './Subject';
export { default as Topic, type ITopic } from './Topic';
export { default as Class, type IClass } from './Class';
export { default as Attendance, type IAttendance } from './Attendance';
export { default as Lesson, type ILesson, type LessonProgress } from './Lesson';

export { default as Assignment, type IAssignment } from './Assignment';
export {
  default as AssignmentSubmission,
  type IAssignmentSubmission,
} from './AssignmentSubmission';
export { default as Test, type ITest } from './Test';
export { default as Question, type IQuestion } from './Question';
export { default as TestAttempt, type ITestAttempt, type IAnswer } from './TestAttempt';
export { default as Result, type IResult } from './Result';
export { default as MarkAdjustment, type IMarkAdjustment } from './MarkAdjustment';
export { default as Performance, type IPerformance } from './Performance';
export { default as StudyMaterial, type IStudyMaterial } from './StudyMaterial';

export { default as Package, type IPackage } from './Package';
export { default as Subscription, type ISubscription } from './Subscription';
export { default as Payment, type IPayment } from './Payment';
export { default as Invoice, type IInvoice } from './Invoice';

export { default as Notification, type INotification } from './Notification';
export { default as Message, type IMessage } from './Message';
export { default as AiConversation, type IAiConversation } from './AiConversation';
export { default as AiMessage, type IAiMessage } from './AiMessage';
export { default as ZoomMeeting, type IZoomMeeting } from './ZoomMeeting';
export { default as AuditLog, type IAuditLog } from './AuditLog';

export { default as RateLimit, type IRateLimit } from './RateLimit';
export {
  default as PasswordToken,
  type IPasswordToken,
  type TokenPurpose,
} from './PasswordToken';
export { default as ParentInvite, type IParentInvite } from './ParentInvite';
export { default as Subscriber, type ISubscriber } from './Subscriber';
export { default as BookingRequest, type IBookingRequest } from './BookingRequest';
export { default as Booking, type IBooking, type BookingStatus } from './Booking';
export { default as Availability, type IAvailability } from './Availability';

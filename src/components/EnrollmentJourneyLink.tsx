import type {ComponentProps} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {readChatRecommendation} from '../utils/chatJourneyNavigation';

export function useEnrollmentChatReturnState() {
  const chatRecommendation=readChatRecommendation(useLocation().state);
  return chatRecommendation?{chatRecommendation}:undefined;
}

export function EnrollmentJourneyLink({state,...props}:ComponentProps<typeof Link>) {
  const returnState=useEnrollmentChatReturnState();
  return <Link {...props} state={state??returnState}/>;
}

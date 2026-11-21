import {createContext, useContext, type ReactNode} from 'react';
import {NavigationType, UNSAFE_LocationContext, useLocation, useNavigationType} from 'react-router-dom';
import {siteChatBackground} from '../utils/siteChatLocation';

const Background = createContext<ReturnType<typeof siteChatBackground>>(undefined);
export const useSiteChatBackground = () => useContext(Background);

export function SiteChatRoutes({children}: {children:ReactNode}) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const background = siteChatBackground(location);
  // Keep the same route tree mounted during expansion. Navigation and page analytics
  // outside this provider still use the actual browser route.
  const route = background ? {location:background.location,navigationType:NavigationType.Pop} : {location,navigationType};
  return <Background.Provider value={background}>
    <UNSAFE_LocationContext.Provider value={route}>{children}</UNSAFE_LocationContext.Provider>
  </Background.Provider>;
}

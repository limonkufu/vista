// Mock for next-nprogress-bar
export const AppProgressBar = () => null;

// Also mock the navigation object that the real component tries to access
export const navigation = {
  usePathname: () => "/dashboard",
};

export default {
  AppProgressBar,
  navigation,
};

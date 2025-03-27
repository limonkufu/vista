declare module "@icons-pack/react-simple-icons" {
  import { SVGProps } from "react";

  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
  }

  export const SiGithub: React.FC<IconProps>;
}

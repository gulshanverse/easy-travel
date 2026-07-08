/// <reference types="vite/client" />

// vite-imagetools — typed picture output
declare module "*&as=picture" {
  interface PictureSources {
    [format: string]: string;
  }
  const value: {
    sources: PictureSources;
    img: { src: string; w: number; h: number };
  };
  export default value;
}

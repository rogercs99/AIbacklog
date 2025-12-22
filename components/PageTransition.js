"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [swipeKey, setSwipeKey] = useState(0);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    if (prevPathRef.current === pathname) {
      return undefined;
    }
    prevPathRef.current = pathname;
    setSwipeKey((value) => value + 1);
    setSwiping(true);
    const timer = window.setTimeout(() => setSwiping(false), 520);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {swiping ? <div key={swipeKey} className="route-swipe" aria-hidden="true" /> : null}
      <div key={pathname} className="page-transition">
        {children}
      </div>
    </>
  );
}

import React from 'react';
// Presentation-only links. No application router, auth or server path.
export default function PreviewLink({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}) {return <a {...props} href={href.startsWith('#')?href:'#overview'}>{children}</a>;}

import {Children, isValidElement, type ReactNode} from 'react';
import Markdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';

const replyMarkdown:Components={
  p({node,children,...props}){
    const content=node?.children.filter(child=>child.type!=='text'||child.value.trim());
    const allStrong=content?.length&&content.every(child=>child.type==='element'&&child.tagName==='strong');
    return <p {...props}>{allStrong?Children.map(children,child=>(
      isValidElement<{children?:ReactNode}>(child)&&child.type==='strong'?child.props.children:child
    )):children}</p>;
  },
};

export default function ChatReplyMarkdown({content}:{content:string}) {
  return <Markdown components={replyMarkdown} remarkPlugins={[remarkGfm]}>{content}</Markdown>;
}

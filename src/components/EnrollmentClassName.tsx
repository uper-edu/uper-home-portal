export function EnrollmentClassName({title}:{title:string}) {
  return <span className="enrollment-card-title">
    {title.split(' · ').map((part,index)=>
      <span className="enrollment-title-part" key={index}>{(index?' · ':'')+part}</span>
    )}
  </span>;
}

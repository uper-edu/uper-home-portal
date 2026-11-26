export function EnrollmentClassName({title}:{title:string}) {
  return <span className="enrollment-card-title">
    {title.split(' · ').map((part,index)=>
      <span className="enrollment-title-part" key={index}>
        {index>0&&<span className="enrollment-title-separator">{' · '}</span>}{part}
      </span>
    )}
  </span>;
}

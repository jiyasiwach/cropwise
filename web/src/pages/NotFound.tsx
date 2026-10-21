import { ButtonLink, PageTitle } from '../components/ui'

export default function NotFound() {
  return (
    <div>
      <PageTitle title="Page not found" subtitle="That page does not exist. Everything CropWise does starts from Home." />
      <ButtonLink to="/">Go home</ButtonLink>
    </div>
  )
}

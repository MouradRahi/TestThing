import { getPayload } from '@/lib/payload'
import { CustomRequestForm, type GarmentOption } from '@/components/custom-request/CustomRequestForm'

export const revalidate = 300

export default async function CustomRequestPage() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'garment-types',
    limit: 50,
    sort: '_order',
    select: { name: true },
  })

  const garmentTypes: GarmentOption[] = docs.map((d) => ({ id: String(d.id), name: d.name as string }))

  return <CustomRequestForm garmentTypes={garmentTypes} />
}

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useBulkUpload, useModal } from '@payloadcms/ui'

// Re-adds Payload's "Bulk upload" action to our custom Media grid view.
// Mirrors the default ListBulkUploadButton: open the bulk-upload drawer for this
// collection and refresh the list on success. Providers come from the admin
// Default template that wraps every view, so the hooks are available here.
export function MediaBulkUploadButton({ collectionSlug }: { collectionSlug: string }) {
  const { drawerSlug, setCollectionSlug, setFolderID, setOnSuccess } = useBulkUpload()
  const { openModal } = useModal()
  const router = useRouter()

  const openBulkUpload = () => {
    setCollectionSlug(collectionSlug)
    setFolderID(undefined)
    openModal(drawerSlug)
    setOnSuccess(() => router.refresh())
  }

  return (
    <button type="button" className="btn btn--style-secondary btn--size-medium" onClick={openBulkUpload}>
      Bulk upload
    </button>
  )
}

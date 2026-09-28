"use client";

import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function EditProfileDialog({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  const handleSave = () => {
    if (!email.trim().includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    toast.success("Profile updated");
    setOpen(false);
  };

  return (
    <>
      <Button intent="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="size-4" />
        Edit profile
      </Button>

      <Modal open={open} onOpenChange={setOpen} size="md">
        <ModalTitle>Edit profile</ModalTitle>
        <p className="text-sm text-sand-500">
          These details are used on requests and quotes you file with Fayfort.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Email" hint="Request and quote updates are sent here">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button intent="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button intent="accent" size="sm" onClick={handleSave}>
            <Save aria-hidden className="size-4" />
            Save changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
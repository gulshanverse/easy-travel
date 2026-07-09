/**
 * Memory Engine — Class registry.
 *
 * Central lookup of class → policy → default kinds, plus registration hooks
 * for extending the taxonomy without touching config.ts.
 */
import type { ClassPolicy, MemoryConfiguration } from "./config";
import type { MemoryClass } from "./types";
import { MEMORY_CLASSES } from "./types";

export interface ClassDescriptor {
  class: MemoryClass;
  policy: ClassPolicy;
  defaultKinds: string[];
}

export class MemoryRegistry {
  private descriptors = new Map<MemoryClass, ClassDescriptor>();

  constructor(config: MemoryConfiguration) {
    for (const c of MEMORY_CLASSES) {
      this.descriptors.set(c, { class: c, policy: config.classPolicies[c], defaultKinds: [] });
    }
  }

  register(descriptor: ClassDescriptor): void {
    this.descriptors.set(descriptor.class, descriptor);
  }

  get(class_: MemoryClass): ClassDescriptor {
    const d = this.descriptors.get(class_);
    if (!d) throw new Error(`No descriptor registered for class ${class_}`);
    return d;
  }

  list(): ClassDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  updatePolicy(class_: MemoryClass, patch: Partial<ClassPolicy>): void {
    const d = this.get(class_);
    d.policy = { ...d.policy, ...patch };
  }
}

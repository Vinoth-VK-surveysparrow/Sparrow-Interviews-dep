'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import { Avatar as AvatarPrimitive } from 'radix-ui';

const avatarStatusVariants = cva('flex items-center rounded-full size-2 border-2 border-background', {
  variants: {
    variant: {
      online: 'bg-green-600',
      offline: 'bg-zinc-600 dark:bg-zinc-300',
      busy: 'bg-yellow-600',
      away: 'bg-blue-600',
    },
  },
  defaultVariants: {
    variant: 'online',
  },
});

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    data-slot="avatar"
    className={cn('relative flex shrink-0 size-10', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <div className={cn('relative overflow-hidden rounded-full', className)}>
      <AvatarPrimitive.Image data-slot="avatar-image" className={cn('aspect-square h-full w-full')} {...props} />
    </div>
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full text-muted-foreground text-xs',
        className,
      )}
      {...props}
    />
  );
}

function AvatarIndicator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-indicator"
      className={cn('absolute flex size-6 items-center justify-center', className)}
      {...props}
    />
  );
}

function AvatarStatus({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof avatarStatusVariants>) {
  return <div data-slot="avatar-status" className={cn(avatarStatusVariants({ variant }), className)} {...props} />;
}

export { Avatar, AvatarFallback, AvatarImage, AvatarIndicator, AvatarStatus, avatarStatusVariants };


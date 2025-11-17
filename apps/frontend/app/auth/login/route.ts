import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

export async function GET() {
    const authorizationUrl = await getSignInUrl({
        redirectUri: `${process.env.NEXT_PUBLIC_ORIGIN}/secure`
    });
    return redirect(authorizationUrl);
}

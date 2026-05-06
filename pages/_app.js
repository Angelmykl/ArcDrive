import { ThirdwebProvider } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

export default function App({ Component, pageProps }) {
  return (
    <ThirdwebProvider client={client} activeChain={sepolia}>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}
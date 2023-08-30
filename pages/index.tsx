import {
  PublicKey,
  publicKey,
  Umi,
} from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import dynamic from "next/dynamic";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useUmi } from "../utils/useUmi";
import { fetchCandyMachine, safeFetchCandyGuard, CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-candy-machine"
import styles from "../styles/Home.module.css";
import { guardChecker } from "../utils/checkAllowed";
import { Center, Card, CardHeader, CardBody, StackDivider, Heading, Stack, useToast, Text, Skeleton, useDisclosure, Button, Modal, ModalBody, ModalCloseButton, ModalContent, Image, ModalHeader, ModalOverlay, Box, Divider, VStack, Flex } from '@chakra-ui/react';
import { ButtonList } from "../components/mintButton";
import { GuardReturn } from "../utils/checkerHelper";
import { ShowNft } from "../components/showNft";
import { InitializeModal } from "../components/initializeModal";
import { image, headerText } from "../settings";
import { useSolanaTime } from "@/utils/SolanaTimeContext";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const useCandyMachine = (umi: Umi, candyMachineId: string, checkEligibility: boolean, setCheckEligibility: Dispatch<SetStateAction<boolean>>) => {
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();
  const toast = useToast();


  useEffect(() => {
    (async () => {
      if (checkEligibility) {
        if (!candyMachineId) {
          console.error("No candy machine in .env!");
          if (!toast.isActive("no-cm")) {
            toast({
              id: "no-cm",
              title: "No candy machine in .env!",
              description: "Add your candy machine address to the .env file!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
          }
          return;
        }

        let candyMachine;
        try {
          candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
          console.log(candyMachine);
        } catch (e) {
          console.error(e);
          toast({
            id: "no-cm-found",
            title: "The CM from .env is invalid",
            description: "Are you using the correct environment?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        setCandyMachine(candyMachine);
        if (!candyMachine) {
          return;
        }
        let candyGuard;
        try {
          candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
        } catch (e) {
          console.error(e);
          toast({
            id: "no-guard-found",
            title: "No Candy Guard found!",
            description: "Do you have one assigned?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        if (!candyGuard) {
          return;
        }
        setCandyGuard(candyGuard);
        setCheckEligibility(false)
      }
    })();
  }, [umi, checkEligibility]);

  return { candyMachine, candyGuard };


};

export interface IsMinting {
  label: string;
  minting: boolean;
}

export default function Home() {
  const umi = useUmi();
  const solanaTime = useSolanaTime();
  const toast = useToast();
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey, offChainMetadata: JsonMetadata | undefined }[] | undefined>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([
    { label: "startDefault", allowed: false },
  ]);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);

  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!")
    if (!toast.isActive('no-cm')) {
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
    }
  }
  const candyMachineId: PublicKey = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    } else {
      console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
      return publicKey("11111111111111111111111111111111");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { candyMachine, candyGuard } = useCandyMachine(umi, candyMachineId, checkEligibility, setCheckEligibility);

  useEffect(() => {
    const checkEligibility = async () => {
      if (candyMachine === undefined || !candyGuard || !checkEligibility) {
        return;
      }

      const { guardReturn, ownedTokens } = await guardChecker(
        umi, candyGuard, candyMachine, solanaTime
      );

      setOwnedTokens(ownedTokens);
      setGuards(guardReturn);
      setIsAllowed(false);

      let allowed = false;
      for (const guard of guardReturn) {
        if (guard.allowed) {
          allowed = true;
          break;
        }
      }

      setIsAllowed(allowed);
      setLoading(false);
    };

    checkEligibility();
    // On purpose: not check for candyMachine, candyGuard, solanaTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umi, checkEligibility]);

  const PageContent = () => {

    return (
      <>
        <style jsx global>
          {`
      body {
          background-position: center;
          background-image: url("https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/95923662-38e8-44e3-9acc-88a7731db825/dful1eg-36e9a5f3-417a-4d1b-af68-1e172bc1a09c.jpg/v1/fill/w_1920,h_799,q_75,strp/code_of_life_by_aronvisuals_dful1eg-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9Nzk5IiwicGF0aCI6IlwvZlwvOTU5MjM2NjItMzhlOC00NGUzLTlhY2MtODhhNzczMWRiODI1XC9kZnVsMWVnLTM2ZTlhNWYzLTQxN2EtNGQxYi1hZjY4LTFlMTcyYmMxYTA5Yy5qcGciLCJ3aWR0aCI6Ijw9MTkyMCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.32YZ2SbPuVLkc_Q9GTgKbklf5u9SrxyivptKtumKbas"); 
       }
   `}
        </style>
        <Card backgroundColor={"#1e2423cc"} color={"white"}>
          <CardHeader>
            <Flex minWidth='max-content' alignItems='center' gap='2'>
              <Box>
                {/* <Heading size='md'>{headerText}</Heading> */}
              </Box>
            </Flex>
          </CardHeader>
          <CardBody>
            <Center>
              <Box
                rounded={'lg'}
                mt={-12}
                pos={'relative'}>
                <Image
                  rounded={'lg'}
                  height={230}
                  objectFit={'cover'}
                  alt={"project Image"}
                  src={image}
                />
              </Box>
            </Center>
            <Divider my="10px" />
            {/* {loading ? (<></>) : (
                <Flex justifyContent="center">
                  <Box background={"teal.100"} borderRadius={"5px"} minWidth={"50px"} minHeight={"50px"} p={2} >
                    <VStack >
                      <Text fontSize={"sm"} color={"grey"}>Minted NFTs:</Text>
                      <Text fontWeight={"semibold"} color={"grey"}>{Number(candyMachine?.itemsRedeemed)}/{Number(candyMachine?.data.itemsAvailable)}</Text>
                    </VStack>
                  </Box>
                </Flex>
              )} */}
            <Stack divider={<StackDivider />} spacing='8'>
              {/* {loading ? (
                <div>
                  <Skeleton height="30px" my="10px" />
                  <Skeleton height="30px" my="10px" />
                  <Skeleton height="30px" my="10px" />
                </div>
              ) : (
                <ButtonList
                  guardList={guards}
                  candyMachine={candyMachine}
                  candyGuard={candyGuard}
                  umi={umi}
                  ownedTokens={ownedTokens}
                  toast={toast}
                  setGuardList={setGuards}
                  mintsCreated={mintsCreated}
                  setMintsCreated={setMintsCreated}
                  onOpen={onShowNftOpen}
                  setCheckEligibility={setCheckEligibility}
                />
              )} */}
              
            </Stack>
          </CardBody>
        </Card >
        {umi.identity.publicKey === candyMachine?.authority ? (
          <>
            <Center>
              <Button backgroundColor={"red.200"} marginTop={"10"} onClick={onInitializerOpen}>Initialize Everything!</Button>
            </Center>
            <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
              <ModalOverlay />
              <ModalContent maxW="600px">
                <ModalHeader>Initializer</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  < InitializeModal umi={umi} candyMachine={candyMachine} candyGuard={candyGuard} toast={toast} />
                </ModalBody>
              </ModalContent>
            </Modal>

          </>)
          :
          (<></>)
        }

        <Modal isOpen={isShowNftOpen} onClose={onShowNftClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Your minted NFT:</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <ShowNft nfts={mintsCreated} />
            </ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
  };

  return (
    <main>
      <div className={styles.wallet}>
        <WalletMultiButtonDynamic />
      </div>

      <div className={styles.center}>
        <PageContent key="content" />
      </div>
    </main>
  );
}

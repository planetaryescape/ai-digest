import { Hr, Section, Text } from "@react-email/components";

interface EmailFooterProps {
  unsubscribeUrl?: string;
  showPoweredBy?: boolean;
  className?: string;
}

export const EmailFooter = ({
  unsubscribeUrl,
  showPoweredBy = true,
  className = "mt-8",
}: EmailFooterProps) => {
  return (
    <Section className={className}>
      <Hr className="border-gray-200" />
      <div className="text-center pt-4">
        {showPoweredBy && (
          <Text className="text-xs text-gray-500 mb-2">
            Powered by AI Digest - Your weekly AI newsletter companion
          </Text>
        )}
        {unsubscribeUrl && (
          <Text className="text-xs text-gray-400">
            <a href={unsubscribeUrl} className="text-gray-400 underline">
              Unsubscribe
            </a>
          </Text>
        )}
        <Text className="text-xs text-gray-400 mt-2">
          © {new Date().getFullYear()} AI Digest. All rights reserved.
        </Text>
      </div>
    </Section>
  );
};

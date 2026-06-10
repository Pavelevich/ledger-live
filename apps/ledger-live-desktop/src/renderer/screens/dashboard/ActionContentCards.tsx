import { Carousel } from "@ledgerhq/react-ui";
import { ABTestingVariants } from "@ledgerhq/types-live";
import React, { useMemo } from "react";
import styled from "styled-components";
import { useRefreshAccountsOrderingEffect } from "~/renderer/actions/general";
import { Card } from "~/renderer/components/Box";
import useActionCards from "~/renderer/hooks/useActionCards";
import ActionCard from "~/renderer/components/ContentCards/ActionCard";
import LogContentCardWrapper from "LLD/features/DynamicContent/components/LogContentCardWrapper";

const ActionVariantA = styled(Card)`
  background-color: ${p => p.theme.colors.opacityPurple.c10};
`;

const ActionContentCards = ({ variant }: { variant: ABTestingVariants }) => {
  const { actionCards, onClick, onDismiss } = useActionCards();
  const additionalProps = useMemo(() => ({ variant }), [variant]);

  const slides = actionCards.map((slide, index) => (
    <LogContentCardWrapper
      key={slide.id}
      id={slide.id}
      additionalProps={additionalProps}
      displayedPosition={index}
      location={slide.location}
    >
      <ActionCard
        img={slide.image}
        title={slide.title}
        description={slide.description}
        actions={{
          primary: {
            label: slide.mainCta,
            action: () => onClick(slide.id, slide.link, index),
          },
          ...(slide.secondaryCta
            ? {
                dismiss: {
                  label: slide.secondaryCta,
                  action: () => onDismiss(slide.id, index),
                },
              }
            : {}),
        }}
      />
    </LogContentCardWrapper>
  ));

  useRefreshAccountsOrderingEffect({
    onMount: true,
  });

  if (slides.length === 0 || variant !== ABTestingVariants.variantA) return null;

  return (
    <ActionVariantA>
      <Carousel variant="content-card">{slides}</Carousel>
    </ActionVariantA>
  );
};

export default ActionContentCards;

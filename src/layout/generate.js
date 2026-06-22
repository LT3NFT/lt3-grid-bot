/** Ported from lt3-grid-tool/script.js — layout generation only */

function makeTwoUprightLayout() {
  return {
    id: "stack-1x2",
    name: "1x2",
    aspectRatio: 0.5,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: 1, h: 0.5, imageIndex: 0 },
      { x: 0, y: 0.5, w: 1, h: 0.5, imageIndex: 1 },
    ],
  };
}

function makeThreeHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);

  // Solve a no-crop rectangle where image 0 fills left column and
  // images 1/2 stack on right with widths matched.
  const rightW = 1 / (1 / a1 + 1 / a2);
  const topH = rightW / a1;
  const bottomH = rightW / a2;
  const totalW = a0 + rightW;

  const leftWNorm = a0 / totalW;
  const rightWNorm = rightW / totalW;

  return {
    id: "hero-1x2",
    name: "1x2",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: 1, imageIndex: 0 },
      { x: leftWNorm, y: 0, w: rightWNorm, h: topH, imageIndex: 1 },
      { x: leftWNorm, y: topH, w: rightWNorm, h: bottomH, imageIndex: 2 },
    ],
  };
}

function makeThreeTopHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);

  // Solve a no-crop rectangle where image 0 spans top row and
  // images 1/2 share the bottom row.
  const bottomW = a1 + a2;
  const topH = bottomW / a0;
  const bottomH = 1;
  const totalH = topH + bottomH;

  const topHNorm = topH / totalH;
  const bottomHNorm = bottomH / totalH;
  const bottomW1Norm = a1 / bottomW;

  return {
    id: "hero-2x1",
    name: "2x1",
    aspectRatio: bottomW / totalH,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: 1, h: topHNorm, imageIndex: 0 },
      { x: 0, y: topHNorm, w: bottomW1Norm, h: bottomHNorm, imageIndex: 1 },
      { x: bottomW1Norm, y: topHNorm, w: 1 - bottomW1Norm, h: bottomHNorm, imageIndex: 2 },
    ],
  };
}

function makeFourGridLayout() {
  return {
    id: "grid-2x2",
    name: "2x2",
    aspectRatio: 1,
    fit: "cover",
    rects: [
      { x: 0, y: 0, w: 0.5, h: 0.5, imageIndex: 0 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, imageIndex: 1 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, imageIndex: 2 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, imageIndex: 3 },
    ],
  };
}

function makeFourSideHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);

  // One large image on left, three stacked on right.
  const rightW = 1 / (1 / a1 + 1 / a2 + 1 / a3);
  const h1 = rightW / a1;
  const h2 = rightW / a2;
  const h3 = rightW / a3;
  const totalW = a0 + rightW;

  const leftWNorm = a0 / totalW;
  const rightWNorm = rightW / totalW;

  return {
    id: "hero-1x3",
    name: "1x3",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: 1, imageIndex: 0 },
      { x: leftWNorm, y: 0, w: rightWNorm, h: h1, imageIndex: 1 },
      { x: leftWNorm, y: h1, w: rightWNorm, h: h2, imageIndex: 2 },
      { x: leftWNorm, y: h1 + h2, w: rightWNorm, h: h3, imageIndex: 3 },
    ],
  };
}

function makeFiveTopTwoBottomThreeLayout(images) {
  const top = images.slice(0, 2);
  const bottom = images.slice(2, 5);
  const topSum = Math.max(0.0001, top.reduce((sum, image) => sum + image.width / image.height, 0));
  const bottomSum = Math.max(0.0001, bottom.reduce((sum, image) => sum + image.width / image.height, 0));
  const topHeight = bottomSum / (topSum + bottomSum);
  const bottomHeight = 1 - topHeight;

  let topX = 0;
  const topRects = top.map((image, i) => {
    const width = (image.width / image.height) / topSum;
    const rect = { x: topX, y: 0, w: width, h: topHeight, imageIndex: i };
    topX += width;
    return rect;
  });

  let bottomX = 0;
  const bottomRects = bottom.map((image, i) => {
    const width = (image.width / image.height) / bottomSum;
    const rect = { x: bottomX, y: topHeight, w: width, h: bottomHeight, imageIndex: i + 2 };
    bottomX += width;
    return rect;
  });

  // Absorb floating-point residue so edges meet perfectly.
  topRects[topRects.length - 1].w += 1 - (topRects[topRects.length - 1].x + topRects[topRects.length - 1].w);
  bottomRects[bottomRects.length - 1].w += 1 - (bottomRects[bottomRects.length - 1].x + bottomRects[bottomRects.length - 1].w);

  return {
    id: "split-2-3",
    name: "3x2",
    aspectRatio: (topSum * bottomSum) / (topSum + bottomSum),
    fit: "contain",
    rects: [...topRects, ...bottomRects],
  };
}

function makeFiveSideTwoThreeLayout(images) {
  const left = images.slice(0, 2);
  const right = images.slice(2, 5);

  const leftA = left.map((image) => Math.max(0.0001, image.width / image.height));
  const rightA = right.map((image) => Math.max(0.0001, image.width / image.height));

  // Two stacked on left and three stacked on right, no-crop rectangle.
  const leftW = 1 / (1 / leftA[0] + 1 / leftA[1]);
  const rightW = 1 / (1 / rightA[0] + 1 / rightA[1] + 1 / rightA[2]);
  const totalW = leftW + rightW;

  const leftWNorm = leftW / totalW;
  const rightWNorm = rightW / totalW;

  const h0 = leftW / leftA[0];
  const h1 = leftW / leftA[1];
  const h2 = rightW / rightA[0];
  const h3 = rightW / rightA[1];
  const h4 = rightW / rightA[2];

  return {
    id: "split-2x3-horizontal",
    name: "2x3",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: h0, imageIndex: 0 },
      { x: 0, y: h0, w: leftWNorm, h: h1, imageIndex: 1 },
      { x: leftWNorm, y: 0, w: rightWNorm, h: h2, imageIndex: 2 },
      { x: leftWNorm, y: h2, w: rightWNorm, h: h3, imageIndex: 3 },
      { x: leftWNorm, y: h2 + h3, w: rightWNorm, h: h4, imageIndex: 4 },
    ],
  };
}

function makeFiveCenterHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);

  // Two stacked on each side with a full-height center hero image.
  const leftW = 1 / (1 / a0 + 1 / a1);
  const centerW = a2;
  const rightW = 1 / (1 / a3 + 1 / a4);
  const totalW = leftW + centerW + rightW;

  const leftWNorm = leftW / totalW;
  const centerWNorm = centerW / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const rightTopH = rightW / a3;

  return {
    id: "hero-2x1x2",
    name: "2x1x2",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: 1 - leftTopH, imageIndex: 1 },
      { x: leftWNorm, y: 0, w: centerWNorm, h: 1, imageIndex: 2 },
      { x: leftWNorm + centerWNorm, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 3 },
      { x: leftWNorm + centerWNorm, y: rightTopH, w: rightWNorm, h: 1 - rightTopH, imageIndex: 4 },
    ],
  };
}

function makeSixDoubleCenterWithSideStacksLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);

  // Two stacked on left, two full-height hero images in center, two stacked on right.
  const leftW = 1 / (1 / a0 + 1 / a1);
  const centerLeftW = a2;
  const centerRightW = a3;
  const rightW = 1 / (1 / a4 + 1 / a5);
  const totalW = leftW + centerLeftW + centerRightW + rightW;

  const leftWNorm = leftW / totalW;
  const centerLeftWNorm = centerLeftW / totalW;
  const centerRightWNorm = centerRightW / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const rightTopH = rightW / a4;

  const centerStartX = leftWNorm;
  const rightStartX = leftWNorm + centerLeftWNorm + centerRightWNorm;

  return {
    id: "hero-2x1x1x2",
    name: "2x1x1x2",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: 1 - leftTopH, imageIndex: 1 },
      { x: centerStartX, y: 0, w: centerLeftWNorm, h: 1, imageIndex: 2 },
      { x: centerStartX + centerLeftWNorm, y: 0, w: centerRightWNorm, h: 1, imageIndex: 3 },
      { x: rightStartX, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 4 },
      { x: rightStartX, y: rightTopH, w: rightWNorm, h: 1 - rightTopH, imageIndex: 5 },
    ],
  };
}

function makeSevenCenterHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);
  const a6 = Math.max(0.0001, images[6].width / images[6].height);

  // Three stacked on left, one full-height hero in center, three stacked on right.
  const leftW = 1 / (1 / a0 + 1 / a1 + 1 / a2);
  const centerW = a3;
  const rightW = 1 / (1 / a4 + 1 / a5 + 1 / a6);
  const totalW = leftW + centerW + rightW;

  const leftWNorm = leftW / totalW;
  const centerWNorm = centerW / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const leftMidH = leftW / a1;
  const rightTopH = rightW / a4;
  const rightMidH = rightW / a5;

  const centerX = leftWNorm;
  const rightX = leftWNorm + centerWNorm;

  return {
    id: "hero-3x1x3",
    name: "3x1x3",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: leftMidH, imageIndex: 1 },
      { x: 0, y: leftTopH + leftMidH, w: leftWNorm, h: 1 - leftTopH - leftMidH, imageIndex: 2 },
      { x: centerX, y: 0, w: centerWNorm, h: 1, imageIndex: 3 },
      { x: rightX, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 4 },
      { x: rightX, y: rightTopH, w: rightWNorm, h: rightMidH, imageIndex: 5 },
      { x: rightX, y: rightTopH + rightMidH, w: rightWNorm, h: 1 - rightTopH - rightMidH, imageIndex: 6 },
    ],
  };
}

function makeSevenTripleCenterWithSideStacksLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);
  const a6 = Math.max(0.0001, images[6].width / images[6].height);

  // Left stack of 2, middle 3 full-height heroes, right stack of 2.
  const leftW = 1 / (1 / a0 + 1 / a1);
  const mid0W = a2;
  const mid1W = a3;
  const mid2W = a4;
  const rightW = 1 / (1 / a5 + 1 / a6);
  const totalW = leftW + mid0W + mid1W + mid2W + rightW;

  const leftWNorm = leftW / totalW;
  const mid0WNorm = mid0W / totalW;
  const mid1WNorm = mid1W / totalW;
  const mid2WNorm = mid2W / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const rightTopH = rightW / a5;

  const midStartX = leftWNorm;
  const rightX = leftWNorm + mid0WNorm + mid1WNorm + mid2WNorm;

  return {
    id: "hero-2x3x2-center",
    name: "2x3x2",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: 1 - leftTopH, imageIndex: 1 },
      { x: midStartX, y: 0, w: mid0WNorm, h: 1, imageIndex: 2 },
      { x: midStartX + mid0WNorm, y: 0, w: mid1WNorm, h: 1, imageIndex: 3 },
      { x: midStartX + mid0WNorm + mid1WNorm, y: 0, w: mid2WNorm, h: 1, imageIndex: 4 },
      { x: rightX, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 5 },
      { x: rightX, y: rightTopH, w: rightWNorm, h: 1 - rightTopH, imageIndex: 6 },
    ],
  };
}

function makeEightCenterDoubleHeroLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);
  const a6 = Math.max(0.0001, images[6].width / images[6].height);
  const a7 = Math.max(0.0001, images[7].width / images[7].height);

  // Three stacked on left, two full-height heroes in center, three stacked on right.
  const leftW = 1 / (1 / a0 + 1 / a1 + 1 / a2);
  const centerLeftW = a3;
  const centerRightW = a4;
  const rightW = 1 / (1 / a5 + 1 / a6 + 1 / a7);
  const totalW = leftW + centerLeftW + centerRightW + rightW;

  const leftWNorm = leftW / totalW;
  const centerLeftWNorm = centerLeftW / totalW;
  const centerRightWNorm = centerRightW / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const leftMidH = leftW / a1;
  const rightTopH = rightW / a5;
  const rightMidH = rightW / a6;

  const centerX = leftWNorm;
  const rightX = leftWNorm + centerLeftWNorm + centerRightWNorm;

  return {
    id: "hero-3x2x3",
    name: "3x2x3",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: leftMidH, imageIndex: 1 },
      { x: 0, y: leftTopH + leftMidH, w: leftWNorm, h: 1 - leftTopH - leftMidH, imageIndex: 2 },
      { x: centerX, y: 0, w: centerLeftWNorm, h: 1, imageIndex: 3 },
      { x: centerX + centerLeftWNorm, y: 0, w: centerRightWNorm, h: 1, imageIndex: 4 },
      { x: rightX, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 5 },
      { x: rightX, y: rightTopH, w: rightWNorm, h: rightMidH, imageIndex: 6 },
      { x: rightX, y: rightTopH + rightMidH, w: rightWNorm, h: 1 - rightTopH - rightMidH, imageIndex: 7 },
    ],
  };
}

function makeEightLeftTwoThenDoubleThreeStacksLayout(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);
  const a6 = Math.max(0.0001, images[6].width / images[6].height);
  const a7 = Math.max(0.0001, images[7].width / images[7].height);

  // Left stack of 2, then two stacks of 3 on the right.
  const leftW = 1 / (1 / a0 + 1 / a1);
  const midW = 1 / (1 / a2 + 1 / a3 + 1 / a4);
  const rightW = 1 / (1 / a5 + 1 / a6 + 1 / a7);
  const totalW = leftW + midW + rightW;

  const leftWNorm = leftW / totalW;
  const midWNorm = midW / totalW;
  const rightWNorm = rightW / totalW;

  const leftTopH = leftW / a0;
  const midTopH = midW / a2;
  const midMidH = midW / a3;
  const rightTopH = rightW / a5;
  const rightMidH = rightW / a6;

  const midX = leftWNorm;
  const rightX = leftWNorm + midWNorm;

  return {
    id: "stack-2x3x3-horizontal",
    name: "2x3x3",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftTopH, imageIndex: 0 },
      { x: 0, y: leftTopH, w: leftWNorm, h: 1 - leftTopH, imageIndex: 1 },
      { x: midX, y: 0, w: midWNorm, h: midTopH, imageIndex: 2 },
      { x: midX, y: midTopH, w: midWNorm, h: midMidH, imageIndex: 3 },
      { x: midX, y: midTopH + midMidH, w: midWNorm, h: 1 - midTopH - midMidH, imageIndex: 4 },
      { x: rightX, y: 0, w: rightWNorm, h: rightTopH, imageIndex: 5 },
      { x: rightX, y: rightTopH, w: rightWNorm, h: rightMidH, imageIndex: 6 },
      { x: rightX, y: rightTopH + rightMidH, w: rightWNorm, h: 1 - rightTopH - rightMidH, imageIndex: 7 },
    ],
  };
}

function makeTenCenterDoubleHeroWithSideFours(images) {
  const a0 = Math.max(0.0001, images[0].width / images[0].height);
  const a1 = Math.max(0.0001, images[1].width / images[1].height);
  const a2 = Math.max(0.0001, images[2].width / images[2].height);
  const a3 = Math.max(0.0001, images[3].width / images[3].height);
  const a4 = Math.max(0.0001, images[4].width / images[4].height);
  const a5 = Math.max(0.0001, images[5].width / images[5].height);
  const a6 = Math.max(0.0001, images[6].width / images[6].height);
  const a7 = Math.max(0.0001, images[7].width / images[7].height);
  const a8 = Math.max(0.0001, images[8].width / images[8].height);
  const a9 = Math.max(0.0001, images[9].width / images[9].height);

  // Four stacked on left, two full-height hero images in center, four stacked on right.
  const leftW = 1 / (1 / a0 + 1 / a1 + 1 / a2 + 1 / a3);
  const centerLeftW = a4;
  const centerRightW = a5;
  const rightW = 1 / (1 / a6 + 1 / a7 + 1 / a8 + 1 / a9);
  const totalW = leftW + centerLeftW + centerRightW + rightW;

  const leftWNorm = leftW / totalW;
  const centerLeftWNorm = centerLeftW / totalW;
  const centerRightWNorm = centerRightW / totalW;
  const rightWNorm = rightW / totalW;

  const leftH0 = leftW / a0;
  const leftH1 = leftW / a1;
  const leftH2 = leftW / a2;
  const rightH0 = rightW / a6;
  const rightH1 = rightW / a7;
  const rightH2 = rightW / a8;

  const centerX = leftWNorm;
  const rightX = leftWNorm + centerLeftWNorm + centerRightWNorm;

  return {
    id: "hero-4x2x4",
    name: "4x2x4",
    aspectRatio: totalW,
    fit: "contain",
    rects: [
      { x: 0, y: 0, w: leftWNorm, h: leftH0, imageIndex: 0 },
      { x: 0, y: leftH0, w: leftWNorm, h: leftH1, imageIndex: 1 },
      { x: 0, y: leftH0 + leftH1, w: leftWNorm, h: leftH2, imageIndex: 2 },
      { x: 0, y: leftH0 + leftH1 + leftH2, w: leftWNorm, h: 1 - leftH0 - leftH1 - leftH2, imageIndex: 3 },
      { x: centerX, y: 0, w: centerLeftWNorm, h: 1, imageIndex: 4 },
      { x: centerX + centerLeftWNorm, y: 0, w: centerRightWNorm, h: 1, imageIndex: 5 },
      { x: rightX, y: 0, w: rightWNorm, h: rightH0, imageIndex: 6 },
      { x: rightX, y: rightH0, w: rightWNorm, h: rightH1, imageIndex: 7 },
      { x: rightX, y: rightH0 + rightH1, w: rightWNorm, h: rightH2, imageIndex: 8 },
      { x: rightX, y: rightH0 + rightH1 + rightH2, w: rightWNorm, h: 1 - rightH0 - rightH1 - rightH2, imageIndex: 9 },
    ],
  };
}

function makeRowsLayout(images, rowSizes, id, name) {
  const rowAspectSums = [];
  const rows = [];
  let cursor = 0;

  rowSizes.forEach((rowSize) => {
    const rowImages = images.slice(cursor, cursor + rowSize);
    const aspectSum = Math.max(
      0.0001,
      rowImages.reduce((sum, image) => sum + image.width / image.height, 0)
    );
    rowAspectSums.push(aspectSum);
    rows.push(rowImages);
    cursor += rowSize;
  });

  const aspectRatio = 1 / rowAspectSums.reduce((sum, value) => sum + 1 / value, 0);
  const rowHeights = rowAspectSums.map((sum) => aspectRatio / sum);
  const rects = [];
  let y = 0;
  let imageIndex = 0;

  rows.forEach((rowImages, rowIndex) => {
    const sum = rowAspectSums[rowIndex];
    const h = rowHeights[rowIndex];
    let x = 0;

    rowImages.forEach((image) => {
      const w = (image.width / image.height) / sum;
      rects.push({ x, y, w, h, imageIndex });
      x += w;
      imageIndex += 1;
    });

    rects[rects.length - 1].w += 1 - (rects[rects.length - 1].x + rects[rects.length - 1].w);
    y += h;
  });

  if (rects.length) {
    const lastRowStart = rects.length - rowSizes[rowSizes.length - 1];
    rects[lastRowStart].h += 1 - (rects[lastRowStart].y + rects[lastRowStart].h);
  }

  return {
    id,
    name,
    aspectRatio,
    fit: "contain",
    rects,
  };
}

function makeNineCenterLayout(images) {
  const aspect = (index) => images[index].width / images[index].height;

  // Left block: 2 on top, 2 on bottom.
  const leftTopSum = aspect(0) + aspect(1);
  const leftBottomSum = aspect(2) + aspect(3);

  // Right block: 2 on top, 2 on bottom.
  const rightTopSum = aspect(5) + aspect(6);
  const rightBottomSum = aspect(7) + aspect(8);

  const centerAspect = aspect(4);
  const height = 1;

  const leftWidth = height / (1 / leftTopSum + 1 / leftBottomSum);
  const rightWidth = height / (1 / rightTopSum + 1 / rightBottomSum);
  const centerWidth = centerAspect * height;
  const totalWidth = leftWidth + centerWidth + rightWidth;

  const leftTopHeight = leftWidth / leftTopSum;
  const leftBottomHeight = leftWidth / leftBottomSum;
  const rightTopHeight = rightWidth / rightTopSum;
  const rightBottomHeight = rightWidth / rightBottomSum;

  const leftTopW0 = aspect(0) * leftTopHeight;
  const leftBottomW0 = aspect(2) * leftBottomHeight;
  const rightTopW0 = aspect(5) * rightTopHeight;
  const rightBottomW0 = aspect(7) * rightBottomHeight;

  const xCenter = leftWidth;
  const xRight = leftWidth + centerWidth;

  const rects = [
    // Left 2x2 block (images 0-3)
    { x: 0, y: 0, w: leftTopW0, h: leftTopHeight, imageIndex: 0 },
    { x: leftTopW0, y: 0, w: leftWidth - leftTopW0, h: leftTopHeight, imageIndex: 1 },
    { x: 0, y: leftTopHeight, w: leftBottomW0, h: leftBottomHeight, imageIndex: 2 },
    { x: leftBottomW0, y: leftTopHeight, w: leftWidth - leftBottomW0, h: leftBottomHeight, imageIndex: 3 },

    // Center single large image (image 4)
    { x: xCenter, y: 0, w: centerWidth, h: height, imageIndex: 4 },

    // Right 2x2 block (images 5-8)
    { x: xRight, y: 0, w: rightTopW0, h: rightTopHeight, imageIndex: 5 },
    { x: xRight + rightTopW0, y: 0, w: rightWidth - rightTopW0, h: rightTopHeight, imageIndex: 6 },
    { x: xRight, y: rightTopHeight, w: rightBottomW0, h: rightBottomHeight, imageIndex: 7 },
    { x: xRight + rightBottomW0, y: rightTopHeight, w: rightWidth - rightBottomW0, h: rightBottomHeight, imageIndex: 8 },
  ].map((rect) => ({
    ...rect,
    x: rect.x / totalWidth,
    w: rect.w / totalWidth,
  }));

  return {
    id: "grid-2-2-1-2-2",
    name: "2x2x1x2x2",
    aspectRatio: totalWidth / height,
    fit: "contain",
    rects,
  };
}

function makeStripLayout(images) {
  const baseDims = getBaseStripDimensions(images);
  const rects = [];
  let x = 0;

  images.forEach((image, index) => {
    const scale = baseDims.height / image.height;
    const widthAtBaseHeight = Math.max(1, Math.round(image.width * scale));
    const normalizedWidth = widthAtBaseHeight / baseDims.width;
    rects.push({
      x,
      y: 0,
      w: normalizedWidth,
      h: 1,
      imageIndex: index,
    });
    x += normalizedWidth;
  });

  if (rects.length) {
    const delta = 1 - rects[rects.length - 1].x - rects[rects.length - 1].w;
    rects[rects.length - 1].w += delta;
  }

  return {
    id: `strip-${images.length}`,
    name: `${images.length}x1`,
    aspectRatio: baseDims.width / baseDims.height,
    fit: "contain",
    rects,
  };
}

function getBaseStripDimensions(images) {
  if (!images.length) return { width: 1, height: 1 };
  const baseHeight = Math.max(1, Math.min(...images.map((image) => image.height)));
  const width = images.reduce((sum, image) => {
    const scale = baseHeight / image.height;
    return sum + Math.max(1, Math.round(image.width * scale));
  }, 0);
  return {
    width: Math.max(1, width),
    height: baseHeight,
  };
}


function getUniformRowCountsSorted(count) {
  const factorRows = [];
  for (let rows = 2; rows <= count / 2; rows += 1) {
    if (count % rows === 0) {
      const cols = count / rows;
      if (cols >= 2) factorRows.push(rows);
    }
  }

  return factorRows.sort((a, b) => {
    const colsA = count / a;
    const colsB = count / b;
    const squareDiffA = Math.abs(colsA - a);
    const squareDiffB = Math.abs(colsB - b);
    if (squareDiffA !== squareDiffB) return squareDiffA - squareDiffB;

    const areaSkewA = Math.abs(Math.log(colsA / a));
    const areaSkewB = Math.abs(Math.log(colsB / b));
    if (areaSkewA !== areaSkewB) return areaSkewA - areaSkewB;

    const horizontalA = colsA >= a ? 0 : 1;
    const horizontalB = colsB >= b ? 0 : 1;
    if (horizontalA !== horizontalB) return horizontalA - horizontalB;

    return a - b;
  });
}

function formatGeneratedRowsLayoutName(rowSizes) {
  if (!rowSizes.length) return "";
  const isUniform = rowSizes.every((value) => value === rowSizes[0]);
  if (isUniform) {
    return `${rowSizes[0]}x${rowSizes.length}`;
  }
  return rowSizes.join("x");
}

function splitEven(total, parts, fromEnd) {
  const safeParts = Math.max(1, Math.min(total, parts));
  const base = Math.floor(total / safeParts);
  const remainder = total % safeParts;
  const result = new Array(safeParts).fill(base);

  for (let i = 0; i < remainder; i += 1) {
    const slot = fromEnd ? safeParts - 1 - i : i;
    result[slot] += 1;
  }
  return result;
}

function generateLargeCountLayouts(images) {
  const count = images.length;
  const layouts = [];
  const seen = new Set();
  const baseRows = Math.max(2, Math.min(6, Math.round(Math.sqrt(count / 2))));
  const rowCandidates = Array.from(
    new Set([baseRows, Math.max(2, baseRows - 1), Math.min(7, baseRows + 1)])
  );

  const pushRowsLayout = (rowSizes) => {
    const signature = rowSizes.join("-");
    if (seen.has(signature)) return;
    if (signature === "4-4-3") return;
    if (signature === "6-5") return;
    if (count === 13 && (signature === "5-4-4" || signature === "7-6")) return;
    const estimatedAspect = 1 / rowSizes.reduce((sum, value) => sum + 1 / Math.max(1, value), 0);
    if (estimatedAspect < 0.95) return;
    const MAX_ROW_MOSAIC_ASPECT = 4;
    if (estimatedAspect > MAX_ROW_MOSAIC_ASPECT) return;
    seen.add(signature);
    layouts.push(makeRowsLayout(images, rowSizes, `grid-${signature}`, formatGeneratedRowsLayoutName(rowSizes)));
  };

  const uniformRowOptions = getUniformRowCountsSorted(count);
  const preferredUniformRows = uniformRowOptions[0] ?? null;
  if (preferredUniformRows !== null) {
    const preferredCols = count / preferredUniformRows;
    pushRowsLayout(new Array(preferredUniformRows).fill(preferredCols));
  }
  const secondaryUniformRows = uniformRowOptions[1] ?? null;
  if (secondaryUniformRows !== null) {
    const secondaryCols = count / secondaryUniformRows;
    pushRowsLayout(new Array(secondaryUniformRows).fill(secondaryCols));
  }

  if (count === 11) {
    pushRowsLayout([5, 6]);
  }

  rowCandidates.forEach((rows) => {
    if (count >= 14) {
      pushRowsLayout(splitEven(count, rows, true));
      return;
    }
    pushRowsLayout(splitEven(count, rows, false));
    pushRowsLayout(splitEven(count, rows, true));
  });

  if (!layouts.length) {
    pushRowsLayout(splitEven(count, Math.max(2, Math.round(Math.sqrt(count))), false));
  }

  return layouts;
}

function generateLayouts(images) {
  if (!images.length) return [];
  if (images.length === 2) {
    return [makeStripLayout(images), makeTwoUprightLayout()];
  }
  if (images.length === 3) {
    return [makeStripLayout(images), makeThreeHeroLayout(images), makeThreeTopHeroLayout(images)];
  }
  if (images.length === 4) {
    return [makeFourGridLayout(), makeFourSideHeroLayout(images), makeStripLayout(images)];
  }
  if (images.length === 5) {
    return [
      makeFiveTopTwoBottomThreeLayout(images),
      makeFiveSideTwoThreeLayout(images),
      makeFiveCenterHeroLayout(images),
      makeStripLayout(images),
    ];
  }
  if (images.length === 6) {
    return [
      makeRowsLayout(images, [3, 3], "grid-3x2", "3x2"),
      makeRowsLayout(images, [2, 2, 2], "grid-2x3", "2x3"),
      makeRowsLayout(images, [2, 4], "grid-2-4", "2x4"),
      makeSixDoubleCenterWithSideStacksLayout(images),
      makeStripLayout(images),
    ];
  }
  if (images.length === 7) {
    return [
      makeRowsLayout(images, [3, 4], "grid-3-4", "3x4"),
      makeRowsLayout(images, [2, 3, 2], "grid-2-3-2", "2x3x2"),
      makeSevenCenterHeroLayout(images),
      makeSevenTripleCenterWithSideStacksLayout(images),
      makeStripLayout(images),
    ];
  }
  if (images.length === 8) {
    return [
      makeRowsLayout(images, [4, 4], "grid-4x2", "4x2"),
      makeRowsLayout(images, [3, 5], "grid-3-5", "3x5"),
      makeEightLeftTwoThenDoubleThreeStacksLayout(images),
      makeEightCenterDoubleHeroLayout(images),
      makeStripLayout(images),
    ];
  }
  if (images.length === 9) {
    return [
      makeRowsLayout(images, [3, 3, 3], "grid-3x3", "3x3"),
      makeRowsLayout(images, [2, 3, 4], "grid-2-3-4", "2x3x4"),
      makeRowsLayout(images, [4, 5], "grid-4-5", "4x5"),
      makeNineCenterLayout(images),
      makeStripLayout(images),
    ];
  }
  if (images.length === 10) {
    return [
      makeRowsLayout(images, [5, 5], "grid-5x2", "5x2"),
      makeTenCenterDoubleHeroWithSideFours(images),
      makeRowsLayout(images, [4, 6], "grid-4-6", "4x6"),
      makeRowsLayout(images, [2, 4, 4], "grid-2-4-4", "2x4x4"),
      makeStripLayout(images),
    ];
  }
  if (images.length >= 11) {
    return generateLargeCountLayouts(images);
  }

  return [makeStripLayout(images)];
}

export { generateLayouts };

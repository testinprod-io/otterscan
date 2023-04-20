import React from "react";
// import Otter from "./otter.png";

const Logo: React.FC = () => (
  <div className="text-6xl text-link-blue font-title font-bold cursor-default flex items-center justify-center space-x-4">
    <img
      className="rounded-full"
      src="https://otterscan.static.testinprod.io/otter.png"
      width={96}
      height={96}
      alt="An otter scanning"
      title="An otter scanning"
    />
    <span>Optimistic Otterscan</span>
  </div>
);

export default React.memo(Logo);

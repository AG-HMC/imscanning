sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("imscanning.controller.Home", {
        onInit() {
        },
        onAdHocPress: function(source){
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteAdHocList", {
                target: source
            });
        }
    });
});
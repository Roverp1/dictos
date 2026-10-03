# Third-party notices

## Caelestia shell

The local QML visuals adapt Caelestia shell by the Caelestia contributors,
licensed under the GNU General Public License, version 3 (GPL-3.0).

- Source: https://github.com/caelestia-dots/shell
- Inspected revision: `454f46da16ae75cc57f34adf48dea74db0fa5175`
- Upstream license: https://github.com/caelestia-dots/shell/blob/454f46da16ae75cc57f34adf48dea74db0fa5175/LICENSE
- License text: https://www.gnu.org/licenses/gpl-3.0.txt

Adapted material in `qml/components/`:

| Local files | Upstream sources |
| --- | --- |
| `Tokens.qml`, `Anim.qml` | `plugin/src/Caelestia/Config/tokens.hpp`, `plugin/src/Caelestia/Config/appearanceconfig.hpp`, `services/Colours.qml`, `components/Anim.qml` |
| `CaptureButton.qml`, `StateLayer.qml` | `components/controls/ButtonBase.qml`, `components/controls/TextButton.qml`, `components/StateLayer.qml` |
| `CaptureField.qml` | `components/controls/TextFieldBase.qml`, `components/controls/StyledTextField.qml` |
| `CaptureListView.qml` | `components/containers/StyledListView.qml` |
| `BottomSurface.qml` | `modules/launcher/Wrapper.qml`, `modules/drawers/Panels.qml` (bottom attachment and offset/opacity motion) |

Changes replace the C++ configuration singleton and shell services with local
QML tokens, use standard Qt controls, separate navigation from editing, and
omit the upstream ripple renderer and list fake-flick workaround.

No upstream fonts or icons are distributed here. Font family names refer to
installed fonts, with Qt fallback when unavailable.

## Omarchy

`qml/PanelKeyCatcher.qml` and `qml/PointerMoveGate.qml` adapt the files of the
same names in Omarchy's `shell/Ui/`, licensed under the MIT license.

- Source: https://github.com/omacom/omarchy
- Upstream revision: `821ae589059ffdadc970315f866c94b55d268af7`
- Upstream license: https://github.com/omacom/omarchy/blob/821ae589059ffdadc970315f866c94b55d268af7/LICENSE

The upstream license text follows verbatim:

```text
Copyright (c) David Heinemeier Hansson

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
